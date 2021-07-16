/*!
 * Copyright (c) 2017-2021 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const _ = require('lodash');
const bedrock = require('bedrock');
const brLedgerUtils = require('bedrock-ledger-utils');
const {util: {BedrockError}} = bedrock;
const {documentLoader} = require('bedrock-jsonld-document-loader');
const {fromNym} = require('did-veres-one');
const v1 = require('did-veres-one').driver();

const api = {};
module.exports = api;

// delimiters for a DID URL
const splitRegex = /[;|\/|\?|#]/;
// all the keys extracted using the document loader are restricted by the
// `basisBlockHeight` of the operation being validated. This ensures that
// the signatures were valid at the time of signing.
api.createDidDocumentLoader = ({
  basisBlockHeight, ledgerNode, record, recordPatch, operationType
}) => {
  return async function(url) {
    if(!url.startsWith('did:')) {
      return documentLoader(url);
    }
    const {cryptoLd, verificationSuite} = v1;
    const [did] = url.split(splitRegex);

    // if operation type is `CreateWebLedgerRecord`, do not hit records API, we
    // have already validated elsewhere that it is a new record and not a
    // duplicate
    let didDocument;
    if(operationType === 'CreateWebLedgerRecord' &&
      record && record.id === did) {
      // FIXME: do a better check than searching for `:nym:`
      if(did.includes(':nym:')) {
        // generate nym DIDs, do not use record
        ({didDocument} = await fromNym({did, cryptoLd, verificationSuite}));
      } else {
        // FIXME: cloning is required due to jsonld mutating the document
        // FIXME: is this still an issue or can we remove the clone?
        didDocument = bedrock.util.clone(record);
      }
    } else {
      // try to get DID from records API
      try {
        const result = await ledgerNode.records.get(
          {maxBlockHeight: basisBlockHeight, recordId: did});
        didDocument = result.record;
      } catch(e) {
        // throw if DID Doc not found and the DID is not a nym or this is an
        // update operation and we are trying to resolve the DID in the record
        // FIXME: do a better check than searching for `:nym:`
        if(e.name !== 'NotFoundError' || !did.includes(':nym:') ||
          (operationType === 'UpdateWebLedgerRecord' && recordPatch &&
          recordPatch.target === did)) {
          throw e;
        }
        // generate did document from `nym` DID
        ({didDocument} = await fromNym({did, cryptoLd, verificationSuite}));
      }
    }
    if(!url.includes('#')) {
      return {
        contextUrl: null,
        document: didDocument,
        documentUrl: url
      };
    }
    // try to find the specific object in the DID document
    const document = await _pluckDidNode(did, url, didDocument);
    return {
      contextUrl: null,
      document,
      documentUrl: url
    };
  };
};

api.getValidatorParameterSet = async ({
  basisBlockHeight, ledgerNode, validatorParameterSet
}) => {
  const {record} = await ledgerNode.records.get(
    {maxBlockHeight: basisBlockHeight, recordId: validatorParameterSet});
  return record;
};

api.validateService = async ({
  basisBlockHeight, did, ledgerNode, service, validatorParameterSet
}) => {
  let allowedServiceBaseUrl;
  try {
    ({allowedServiceBaseUrl} = await api.getValidatorParameterSet({
      basisBlockHeight, ledgerNode, validatorParameterSet
    }));
  } catch(error) {
    // let NotFoundError pass
    if(error.name !== 'NotFoundError') {
      return {
        error: new BedrockError(
          'Unable to retrieve ValidatorParameterSet.', 'UnknownError', {
            basisBlockHeight,
            // do not expose unknown error details to the user
            public: false,
            httpStatusCode: 400,
            validatorParameterSet,
          }, error),
        valid: false
      };
    }
  }

  if(!allowedServiceBaseUrl) {
    return {
      error: new BedrockError(
        'Invalid ledger validator configuration. `allowedServiceBaseUrl` ' +
        'is not defined.', 'InvalidStateError', {
          basisBlockHeight,
          httpStatusCode: 400,
          public: true,
          validatorParameterSet,
        }),
      valid: false
    };
  }

  const result = api.validateServiceEndpoints(
    {allowedServiceBaseUrl, did, service});
  if(!result.valid) {
    return result;
  }
  // success
  return {valid: true};
};

api.validateServiceEndpoints = ({allowedServiceBaseUrl, did, service}) => {
  const valid = service.every(({serviceEndpoint}) =>
    // NOTE: baseUrl does not end with a forward slash
    allowedServiceBaseUrl.some(baseUrl => {
      if(serviceEndpoint.startsWith(baseUrl)) {
        const path = serviceEndpoint.substr(baseUrl.length);
        if(path === `/${encodeURIComponent(did)}`) {
          return true;
        }
      }
      return false;
    })
  );
  if(!valid) {
    return {
      valid: false,
      error: new BedrockError(
        'Invalid service endpoint.', 'ValidationError', {
          allowedServiceBaseUrl,
          httpStatusCode: 400,
          public: true,
          service,
        })
    };
  }
  return {valid};
};

api.validateElectorPoolElectors = async (
  {electorPool, ledgerNode, maximumElectorCount}) => {
  const {id: ledgerNodeId} = ledgerNode;
  let result;
  try {
    result = await brLedgerUtils.dereferenceElectorPool(
      {electorPool, ledgerNode});
  } catch(e) {
    const error = new BedrockError(
      'An error occurred while dereferencing elector pool electors.',
      e.name, {electorPool, ledgerNodeId}, e);
    return {error, valid: false};
  }
  const electors = Object.values(result);
  const electorCount = Math.min(maximumElectorCount, electors.length);
  const electorIds = [];
  let guarantorElectorCount = 0;
  // collect information about the electors
  for(const elector of electors) {
    electorIds.push(elector.id);
    if(elector.type.includes('Continuity2017GuarantorElector')) {
      guarantorElectorCount++;
    }
  }
  // ensure that there are no duplicate electors
  if(_.uniq(electorIds).length !== electorIds.length) {
    const error = new BedrockError(
      'Duplicate electors detected in the elector pool document.',
      'SyntaxError', {electorPool, ledgerNodeId});
    return {error, valid: false};
  }
  // ensure that an adequate number (f+1) of guarantor electors are defined
  const targetGuarantorElectorCount = _computeTargetElectorCount(
    {coefficient: 1, originalCount: electorCount});
  if(guarantorElectorCount < targetGuarantorElectorCount) {
    const error = new BedrockError(
      'An insufficient number of guarantor electors are defined in the ' +
      'elector pool document.', 'SyntaxError', {
        electorPool, guarantorElectorCount, ledgerNodeId,
        targetGuarantorElectorCount
      });
    return {error, valid: false};
  }
  // success
  return {valid: true};
};

api.validateValidatorParameterSet = ({validatorInput}) => {
  const {record: {allowedServiceBaseUrl}} = validatorInput;
  for(const baseUrl of allowedServiceBaseUrl) {
    if(baseUrl.endsWith('/')) {
      const error = new BedrockError(
        'An allowed service base URL must not end with `/`.', 'SyntaxError', {
          allowedServiceBaseUrl, baseUrl
        });
      return {error, valid: false};
    }
  }
  return {valid: true};
};

function _computeTargetElectorCount({coefficient, originalCount}) {
  if(originalCount === 0) {
    return 0;
  }
  // compute target length
  const f = Math.ceil(originalCount / 3);
  return coefficient * (f - 1) + 1;
}

async function _pluckDidNode(did, target, didDocument) {
  // find verification method in DID document
  for(const property in didDocument) {
    // veres one documents have a rigid structure, only array values contain
    // other nodes to pluck
    const nodes = didDocument[property];
    if(!Array.isArray(nodes)) {
      continue;
    }
    for(const node of nodes) {
      if(node.id === target) {
        return {
          '@context': didDocument['@context'],
          ...node
        };
      }
    }
  }

  const err = new Error('Not Found.');
  err.name = 'NotFoundError';
  err.httpStatusCode = 404;
  err.status = 404;
  throw err;
}
