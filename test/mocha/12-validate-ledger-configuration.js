/*!
 * Copyright (c) 2017-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {documentLoader} = require('bedrock-jsonld-document-loader');
const {util: {clone}} = require('bedrock');
const jsigs = require('jsonld-signatures');
const mockData = require('./mock.data');
const voValidator = require('veres-one-validator');
const v1 = require('did-veres-one').driver();
const {Ed25519Signature2020} =
  require('@digitalbazaar/ed25519-signature-2020');
const {purposes: {AssertionProofPurpose}} = jsigs;

describe('validate API WebLedgerConfiguration', () => {
  it('should validate a ledgerConfiguration', async () => {
    const ledgerConfiguration = clone(mockData.ledgerConfigurations.alpha);

    // The public key material is derived from the nym DID because the
    // maintainers DID does not yet exist on the ledger
    const maintainerDoc = await v1.generate();
    const signingKey =
      maintainerDoc.methodFor({purpose: 'capabilityInvocation'});

    const s = await jsigs.sign(ledgerConfiguration, {
      compactProof: false,
      documentLoader,
      suite: new Ed25519Signature2020({key: signingKey}),
      purpose: new AssertionProofPurpose()
    });

    const result = await voValidator.validate({
      ledgerNode: mockData.ledgerNode,
      validatorInput: s,
    });
    should.exist(result.valid);
    result.valid.should.be.a('boolean');
    result.valid.should.be.true;
  });
  it('rejects a configuration w/missing electorSelectionMethod', async () => {
    const ledgerConfiguration = clone(mockData.ledgerConfigurations.alpha);

    delete ledgerConfiguration.electorSelectionMethod;

    // The public key material is derived from the nym DID because the
    // maintainers DID does not yet exist on the ledger
    const maintainerDoc = await v1.generate();
    const signingKey =
      maintainerDoc.methodFor({purpose: 'capabilityInvocation'});
    const s = await jsigs.sign(ledgerConfiguration, {
      compactProof: false,
      documentLoader,
      suite: new Ed25519Signature2020({key: signingKey}),
      purpose: new AssertionProofPurpose()
    });

    const result = await voValidator.validate({
      ledgerNode: mockData.ledgerNode,
      validatorInput: s,
    });
    should.exist(result.valid);
    result.valid.should.be.a('boolean');
    result.valid.should.be.false;
    should.exist(result.error);
    result.error.name.should.equal('ValidationError');
  });
  it('rejects a configuration w/missing sequence', async () => {
    const ledgerConfiguration = clone(mockData.ledgerConfigurations.alpha);

    delete ledgerConfiguration.sequence;

    // The public key material is derived from the nym DID because the
    // maintainers DID does not yet exist on the ledger
    const maintainerDoc = await v1.generate();
    const signingKey =
      maintainerDoc.methodFor({purpose: 'capabilityInvocation'});
    const s = await jsigs.sign(ledgerConfiguration, {
      compactProof: false,
      documentLoader,
      suite: new Ed25519Signature2020({key: signingKey}),
      purpose: new AssertionProofPurpose()
    });

    const result = await voValidator.validate({
      ledgerNode: mockData.ledgerNode,
      validatorInput: s,
    });
    should.exist(result.valid);
    result.valid.should.be.a('boolean');
    result.valid.should.be.false;
    should.exist(result.error);
    result.error.name.should.equal('ValidationError');
  });
  it('rejects a ledger configuration with an invalid signature', async () => {
    const ledgerConfiguration = clone(mockData.ledgerConfigurations.alpha);

    // The public key material is derived from the nym DID because the
    // maintainers DID does not yet exist on the ledger
    const maintainerDoc = await v1.generate();
    const signingKey =
      maintainerDoc.methodFor({purpose: 'capabilityInvocation'});
    const s = await jsigs.sign(ledgerConfiguration, {
      compactProof: false,
      documentLoader,
      suite: new Ed25519Signature2020({key: signingKey}),
      purpose: new AssertionProofPurpose()
    });
    // replace the proof with a bad one
    s.proof.proofValue = 'z2p7cVPKsvUHzSfMQxziNPmzE7xx5nVHDZG1ZWYCk41gQJxxYr' +
      'rp3Uaqm9Q54e3fe8xaXDpTCctHeGNDB2vw71LZw';
    const result = await voValidator.validate({
      ledgerNode: mockData.ledgerNode,
      validatorInput: s,
    });
    should.exist(result.valid);
    result.valid.should.be.a('boolean');
    result.valid.should.be.false;
    should.exist(result.error);
    result.error.message.should.contain('Proof verification failed.');
  });
  it('rejects configuration signed with an invalid nym did', async () => {
    const ledgerConfiguration = clone(mockData.ledgerConfigurations.alpha);

    // The public key material is derived from the nym DID because the
    // maintainers DID does not yet exist on the ledger
    const maintainerDoc = await v1.generate();
    const signingKey =
      maintainerDoc.methodFor({purpose: 'capabilityInvocation'});
    const s = await jsigs.sign(ledgerConfiguration, {
      compactProof: false,
      documentLoader,
      suite: new Ed25519Signature2020({key: signingKey}),
      purpose: new AssertionProofPurpose()
    });
    s.proof.verificationMethod =
      'did:v1:test:nym:z6MknbD3kDazNR5K5Aj9HtxsaqS1s2NUcTxescFdvZryECFx#' +
      '6MknbD3kDazNR5K5Aj9HtxsaqS1s2NUcTxescFdvZryECFx';

    const result = await voValidator.validate({
      ledgerNode: mockData.ledgerNode,
      validatorInput: s,
    });
    should.exist(result.valid);
    result.valid.should.be.a('boolean');
    result.valid.should.be.false;
    should.exist(result.error);
    result.error.message.should.contain(
      'The signing key is not properly encoded.');
    result.error.cause.message.should.contain(
      '"publicKeyMultibase" has invalid header bytes');
  });
  it('rejects configuration signed with an invalid nym did', async () => {
    const ledgerConfiguration = clone(mockData.ledgerConfigurations.alpha);

    // The public key material is derived from the nym DID because the
    // maintainers DID does not yet exist on the ledger
    const maintainerDoc = await v1.generate();
    const signingKey =
      maintainerDoc.methodFor({purpose: 'capabilityInvocation'});
    const s = await jsigs.sign(ledgerConfiguration, {
      compactProof: false,
      documentLoader,
      suite: new Ed25519Signature2020({key: signingKey}),
      purpose: new AssertionProofPurpose()
    });

    s.proof.verificationMethod =
      'did:v1:test:nym:z6MksN1qAquFzdSgXwVTAYuuLGfckt3UpkhHwFwPsbSiwrUB#' +
      // the 9 here specifies a decimal encoding
      '91234';

    const result = await voValidator.validate({
      ledgerNode: mockData.ledgerNode,
      validatorInput: s,
    });
    should.exist(result.valid);
    result.valid.should.be.a('boolean');
    result.valid.should.be.false;
    should.exist(result.error);
    result.error.message.should.contain(
      'The signing key is not properly encoded.');
    result.error.cause.message.should.contain(
      '"publicKeyMultibase" has invalid header bytes');
  });
});
