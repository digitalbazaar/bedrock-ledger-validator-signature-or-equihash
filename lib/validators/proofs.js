/*!
 * Copyright (c) 2017-2021 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const bedrock = require('bedrock');
const {util: {BedrockError}} = bedrock;
const helpers = require('./helpers');
const jsigs = require('jsonld-signatures');
const {CapabilityInvocation} = require('@digitalbazaar/zcapld');
const {Ed25519Signature2020} =
  require('@digitalbazaar/ed25519-signature-2020');

// TODO: in testnet v2, the `AuthorizeRequest` proof on the operation
// is only validated using json-schema. For v3, use jsigs.verify to properly
// validate the signature
module.exports = async ({basisBlockHeight, ledgerNode, validatorInput}) => {
  // select the required `capabilityAction` based on the operation type
  let capabilityAction;
  let expectedTarget;
  const {record, recordPatch} = validatorInput;

  switch(validatorInput.type) {
    case 'CreateWebLedgerRecord':
      capabilityAction = 'write';
      ({id: expectedTarget} = record);
      break;
    case 'UpdateWebLedgerRecord':
      capabilityAction = 'write';
      ({target: expectedTarget} = recordPatch);
      break;
    default:
      // extra insurance, schema validation should prevent this possibility
      const error = new BedrockError(
        'Unknown operation type.', 'ValidationError', {
          httpStatusCode: 400,
          public: true,
          operation: validatorInput,
        });
      return {valid: false, error};
  }

  const documentLoader = helpers.createDidDocumentLoader({
    basisBlockHeight, ledgerNode, record, recordPatch,
    operationType: validatorInput.type
  });
  // FIXME: need to verify accelerator proof, not just DID controller proof
  const copy = {...validatorInput};
  // only verify the last proof for now
  copy.proof = [copy.proof[copy.proof.length - 1]];
  const result = await jsigs.verify(copy, {
    documentLoader,
    purpose: new CapabilityInvocation({
      expectedAction: capabilityAction,
      // controller: record,
      expectedTarget
    }),
    suite: new Ed25519Signature2020(),
  });
  if(!result.verified) {
    const error = new BedrockError(
      'Proof verification failed.', 'ValidationError', {
        httpStatusCode: 400,
        public: true,
        operation: validatorInput,
        proofVerifyResult: result
      });
    return {valid: false, error};
  }
  // success
  return {valid: true};
};
