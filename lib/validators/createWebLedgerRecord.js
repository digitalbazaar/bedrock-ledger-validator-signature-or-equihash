/*!
 * Copyright (c) 2017-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const bedrock = require('bedrock');
const {util: {BedrockError}} = bedrock;
const helpers = require('./helpers');
const v1 = require('did-veres-one').driver();
const {VeresOneDriver} = require('did-veres-one');
const cfg = bedrock.config['veres-one-validator'];

module.exports = async ({
  basisBlockHeight, electorPool, ledgerNode, validatorInput,
  validatorParameterSet
}) => {
  const {record: {id: recordId}} = validatorInput;
  // NOTE: did:v1:uuid: exception is for electorPool documents
  if(!recordId.startsWith('did:v1:uuid:')) {
    const result = await _validateDid({
      basisBlockHeight, ledgerNode, validatorInput, validatorParameterSet
    });
    if(!result.valid) {
      return result;
    }
  }

  // optimize for general case - no operations with the given `recordId` exists
  // at time of creation
  const exists = await ledgerNode.operations.exists({recordId});
  if(exists) {
    let err;
    try {
      await ledgerNode.records.get({recordId});
    } catch(e) {
      err = e;
    }

    if(!err) {
      const error = new BedrockError(
        'Duplicate DID Document.', 'DuplicateError', {
          httpStatusCode: 400,
          public: true,
          operation: validatorInput,
          recordId,
        });
      return {error, valid: false};
    }
    // if state machine does not have DID and it is to be created (i.e.
    // the record matches the DID), use it as the DID Document
    if(err.name !== 'NotFoundError') {
      return {
        error: new BedrockError(
          'An error occurred in the `records` API.', 'OperationError', {
            httpStatusCode: 400,
            public: true,
            operation: validatorInput,
            recordId,
          }, err),
        valid: false
      };
    }
  }

  if(validatorInput.record.type === 'ValidatorParameterSet') {
    if(validatorParameterSet !== recordId) {
      return {
        error: new BedrockError(
          'Invalid ValidatorParameterSet document ID.', 'ValidationError', {
            actualValue: recordId,
            expectedValue: validatorParameterSet,
            httpStatusCode: 400,
            public: true,
          }),
        valid: false
      };
    }
    return helpers.validateValidatorParameterSet({validatorInput});
  }

  // validate a new electorPool document
  if(electorPool && electorPool === recordId) {
    const {record: {electorPool, maximumElectorCount}} = validatorInput;
    return helpers.validateElectorPoolElectors(
      {electorPool, ledgerNode, maximumElectorCount});
  }
  // success
  return {valid: true};
};

async function _validateDid({
  basisBlockHeight, ledgerNode, validatorInput, validatorParameterSet
}) {
  const didDocument = validatorInput.record;
  let result =
    await VeresOneDriver.validateDid({didDocument, mode: cfg.environment});
  if(!result.valid) {
    return {
      error: new BedrockError(
        'Error validating DID.', 'ValidationError', {
          httpStatusCode: 400,
          public: true,
        }, result.error),
      valid: false
    };
  }
  result = await v1.validateMethodIds({didDocument});
  if(!result.valid) {
    return {
      error: new BedrockError(
        'Error validating DID.', 'ValidationError', {
          httpStatusCode: 400,
          public: true,
        }, result.error),
      valid: false
    };
  }

  const {id: did, service} = didDocument;
  if(service) {
    const result = await helpers.validateService({
      basisBlockHeight, did, ledgerNode, service, validatorParameterSet
    });
    if(!result.valid) {
      return result;
    }
  }
  // success
  return {valid: true};
}
