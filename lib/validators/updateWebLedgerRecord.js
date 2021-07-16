/*!
 * Copyright (c) 2017-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const bedrock = require('bedrock');
const {util: {BedrockError}} = bedrock;
const helpers = require('./helpers');
const jsonpatch = require('fast-json-patch');
const v1 = require('did-veres-one').driver();
const {validate} = require('bedrock-validation');

module.exports = async ({
  basisBlockHeight, electorPool, ledgerNode, validatorInput,
  validatorParameterSet
}) => {
  const {recordPatch} = validatorInput;
  const record = await ledgerNode.records.get({recordId: recordPatch.target});
  const {sequence} = recordPatch;
  const {meta: {sequence: expectedSequence = 0}} = record;
  if(sequence !== expectedSequence) {
    const error = new BedrockError(
      'The given sequence number does not match the current DID ' +
      'Document record.',
      'ValidationError', {
        httpStatusCode: 409,
        public: true,
        sequence,
        expectedSequence
      });
    return {error, valid: false};
  }
  const {patch} = recordPatch;
  const {record: originalDocument} = record;
  const errors = jsonpatch.validate(patch, originalDocument);
  if(errors) {
    const error = new BedrockError(
      'The given JSON patch is invalid.', 'ValidationError', {
        httpStatusCode: 400,
        public: true,
        patch,
        errors
      });
    return {error, valid: false};
  }

  // apply patch
  // no need to validate the patch again
  const validateOperation = false;
  // do not mutate originalDocument
  const mutateDocument = false;
  const {newDocument: patchedDocument} = jsonpatch.applyPatch(
    originalDocument, patch, validateOperation, mutateDocument);

  if(originalDocument.id !== patchedDocument.id) {
    return _immutableValidationError(
      {key: 'id', originalDocument, patchedDocument});
  }
  // if the original document has a type, do not allow it to be changed
  if(originalDocument.type && originalDocument.type !== patchedDocument.type) {
    return _immutableValidationError(
      {key: 'type', originalDocument, patchedDocument});
  }
  if(patchedDocument.type === 'ElectorPool') {
    const result = validate(
      'veres-one-validator.electorPoolDocument', patchedDocument);
    if(!result.valid) {
      return result;
    }
  } else if(patchedDocument.type === 'ValidatorParameterSet') {
    const result = validate(
      'veres-one-validator.validatorParameterSet', patchedDocument);
    if(!result.valid) {
      return result;
    }
  } else {
    // regular cryptonym DID document
    let result = validate(
      'veres-one-validator.updateDidDocument', patchedDocument);
    if(!result.valid) {
      return result;
    }

    const {id: did, service} = patchedDocument;
    if(service) {
      const result = await helpers.validateService({
        basisBlockHeight, did, ledgerNode, service, validatorParameterSet
      });
      if(!result.valid) {
        return result;
      }
    }

    // NOTE: the DID itself (document.id) is not validated here. It was
    // proper when the document was created and may not be updated. It is
    // also possible that the key that informed the creation of a
    // cryptonym (nym) DID may have been removed from the document which
    // makes it impossible to validate the cryptonym.

    // ensure method IDs are valid
    result = await v1.validateMethodIds({didDocument: patchedDocument});

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
  }

  // validate a patched electorPool document
  if(electorPool && electorPool === patchedDocument.id) {
    const {electorPool, maximumElectorCount} = patchedDocument;
    return helpers.validateElectorPoolElectors(
      {electorPool, ledgerNode, maximumElectorCount});
  }
  // success
  return {valid: true};
};

function _immutableValidationError({key, originalDocument, patchedDocument}) {
  return {
    error: new BedrockError(
      `The document "${key}" is immutable.`, 'ValidationError', {
        httpStatusCode: 400,
        public: true,
        originalDocument,
        patchedDocument,
      }),
    valid: false
  };
}
