/*!
 * Copyright (c) 2017-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const bedrock = require('bedrock');
const {config: {constants}, util: {BedrockError}} = bedrock;
const {documentLoader} = require('bedrock-jsonld-document-loader');
const jsigs = require('jsonld-signatures');
const {validate} = require('bedrock-validation');
const {Ed25519Signature2020} =
  require('@digitalbazaar/ed25519-signature-2020');
const {Ed25519VerificationKey2020} =
  require('@digitalbazaar/ed25519-verification-key-2020');
const {AssertionProofPurpose} = jsigs.purposes;
const URL = require('url');

/* eslint-disable-next-line no-unused-vars */
module.exports = async ({ledgerNode, validatorInput}) => {
  // TODO: configuration will need to be signed
  // according to the validator config (use approvedSigners)... and also
  // require the ledgerConfiguration to include a `capabilityRoot` for now
  const result = validate(
    'veres-one-validator.ledgerConfiguration', validatorInput);
  if(!result.valid) {
    return result;
  }
  // FIXME: for testnet_v2, the genesis configuration has a
  // AssertionProofPurpose
  const {proof: {verificationMethod: publicKeyId}} = validatorInput;

  let computedKey;
  let key;
  try {
    computedKey = _getPublicKey(publicKeyId);
    key = await Ed25519VerificationKey2020.from(computedKey);
  } catch(e) {
    const error = new BedrockError(
      'The signing key is not properly encoded.', 'ValidationError', {
        httpStatusCode: 400,
        public: true,
        operation: validatorInput,
      }, e);
    return {valid: false, error};
  }

  const controller = {
    '@context': constants.SECURITY_CONTEXT_URL,
    id: publicKeyId,
    assertionMethod: publicKeyId,
  };
  const proofVerifyResult = await jsigs.verify(validatorInput, {
    documentLoader,
    purpose: new AssertionProofPurpose({controller}),
    suite: new Ed25519Signature2020({key}),
  });
  if(!proofVerifyResult.verified) {
    const error = new BedrockError(
      'Proof verification failed.', 'ValidationError', {
        httpStatusCode: 400,
        public: true,
        operation: validatorInput,
        proofVerifyResult
      });
    return {valid: false, error};
  }
  return {valid: true};
};

function _getPublicKey(publicKeyId) {
  const publicKeyMultibase = _getPublicKeyFromId(publicKeyId);
  return {
    id: publicKeyId,
    type: 'Ed25519VerificationKey2020',
    controller: publicKeyId,
    publicKeyMultibase
  };
}

function _getPublicKeyFromId(publicKeyId) {
  const parsed = URL.parse(publicKeyId);
  // drops the # from the front
  const mbPubkey = parsed.hash.substr(1);

  return mbPubkey;
}
