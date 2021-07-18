/*!
 * Copyright (c) 2017-2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';
const {attachInvocationProof} = require('did-veres-one');
const bedrock = require('bedrock');
const {config: {constants}, util: {uuid, BedrockError}} = bedrock;
const helpers = require('./helpers');
const {httpsAgent} = require('bedrock-https-agent');
const v1 = require('did-veres-one').driver({httpsAgent});
const voValidator = require('veres-one-validator');
const jsonpatch = require('fast-json-patch');

const continuityServiceType = 'Continuity2017Peer';

const ldDocuments = new Map();
const ledgerNode = helpers.createMockLedgerNode({ldDocuments});
const mockData = require('./mock.data');

let maintainerDidDocumentFull;
let electorDidDocumentFull;
let electorServiceId;
describe('validate API ElectorPool', () => {
  describe('operationValidator', () => {
    beforeEach(async () => {
      maintainerDidDocumentFull = await v1.generate();
      const {didDocument: maintainerDidDocument} = maintainerDidDocumentFull;
      ldDocuments.set(maintainerDidDocument.id, maintainerDidDocument);
      electorDidDocumentFull = await v1.generate();
      const {didDocument: electorDidDocument} = electorDidDocumentFull;
      electorServiceId = `${electorDidDocument.id}#MyServiceName`;
      electorDidDocument.service = [{
        id: electorServiceId,
        type: continuityServiceType,
        serviceEndpoint: mockData.electorEndpoint[0],
      }];
      ldDocuments.set(electorDidDocument.id, electorDidDocument);
    });
    describe('create electorPool operation', () => {
      it('validates op with proper proof', async () => {
        const electorPoolDoc = _generateElectorPoolDoc();
        let operation = await _wrap(
          {didDocument: electorPoolDoc, operationType: 'create'});
        const key = _getMaintainerKeys();

        // FIXME: add a write proof for the ledger that will pass json-schema
        // validation for testnet v2 *not* a valid signature
        operation.proof = bedrock.util.clone(mockData.proof);

        operation = await attachInvocationProof({
          operation,
          // capability: maintainerDid,
          capability: electorPoolDoc.id,
          capabilityAction: 'write',
          invocationTarget: operation.record.id,
          key,
          signer: key.signer()
        });

        // FIXME: attach proof instead of mock proof above
        // operation = await attachInvocationProof(operation, {
        //   capability: maintainerDid,
        //   capabilityAction: 'write',
        //   key,
        // });
        const ledgerConfig = bedrock.util.clone(
          mockData.ledgerConfigurations.alpha);
        ledgerConfig.electorSelectionMethod = {
          type: 'VeresOne',
          // corresponds to electorPoolDocument.alpha
          electorPool: electorPoolDoc.id,
        };
        let err;
        let result;
        try {
          result = await voValidator.validate({
            basisBlockHeight: 0,
            ledgerConfig,
            ledgerNode,
            validatorInput: operation,
            validatorConfig: mockData.ledgerConfigurations.alpha
              .operationValidator[0]
          });
        } catch(e) {
          err = e;
        }
        assertNoError(err);
        should.exist(result);
        result.should.be.an('object');
        should.exist(result.valid);
        result.valid.should.be.true;
      });
      it('fails on op with serviceId mismatch', async () => {
        const {id: maintainerDid} = maintainerDidDocumentFull.didDocument;
        const electorPoolDoc = _generateElectorPoolDoc();

        const incorrectServiceId = `${maintainerDid};service=Unknown`;
        electorPoolDoc.electorPool[0].service = incorrectServiceId;

        let operation = await _wrap(
          {didDocument: electorPoolDoc, operationType: 'create'});
        const key = _getMaintainerKeys();
        // FIXME: add a write proof for the ledger that will pass json-schema
        // validation for testnet v2 *not* a valid signature
        operation.proof = bedrock.util.clone(mockData.proof);

        operation = await attachInvocationProof({
          operation,
          // capability: maintainerDid,
          capability: electorPoolDoc.id,
          capabilityAction: 'write',
          invocationTarget: operation.record.id,
          key,
          signer: key.signer()
        });
        // FIXME: attach proof instead of mock proof above
        // operation = await attachInvocationProof(operation, {
        //   capability: maintainerDid,
        //   capabilityAction: 'write',
        //   key,
        // });
        const ledgerConfig = bedrock.util.clone(
          mockData.ledgerConfigurations.alpha);
        ledgerConfig.electorSelectionMethod = {
          type: 'VeresOne',
          // corresponds to electorPoolDocument.alpha
          electorPool: electorPoolDoc.id,
        };
        let err;
        let result;
        try {
          result = await voValidator.validate({
            basisBlockHeight: 0,
            ledgerConfig,
            ledgerNode,
            validatorInput: operation,
            validatorConfig: mockData.ledgerConfigurations.alpha
              .operationValidator[0]
          });
        } catch(e) {
          err = e;
        }
        assertNoError(err);
        result.valid.should.be.false;
        result.error.name.should.equal('NotFoundError');
      });
      it('fails on op if proof is not an array', async () => {
        const {id: maintainerDid} = maintainerDidDocumentFull.didDocument;
        const electorPoolDoc = _generateElectorPoolDoc();
        let operation = await _wrap(
          {didDocument: electorPoolDoc, operationType: 'create'});
        const key = _getMaintainerKeys();
        // no create proof added
        operation = await attachInvocationProof({
          operation,
          capability: maintainerDid,
          capabilityAction: 'write',
          invocationTarget: operation.record.id,
          key,
          signer: key.signer()
        });

        const ledgerConfig = bedrock.util.clone(
          mockData.ledgerConfigurations.alpha);
        ledgerConfig.electorSelectionMethod = {
          type: 'VeresOne',
          // corresponds to electorPoolDocument.alpha
          electorPool: electorPoolDoc.id,
        };
        let err;
        let result;
        try {
          result = await voValidator.validate({
            basisBlockHeight: 0,
            ledgerConfig,
            ledgerNode,
            validatorInput: operation,
            validatorConfig: mockData.ledgerConfigurations.alpha
              .operationValidator[0]
          });
        } catch(e) {
          err = e;
        }
        assertNoError(err);
        result.valid.should.be.false;
        // schema validation detects the missing proof
        result.error.name.should.equal('ValidationError');
      });

      it('fails on op w/only one write capability', async () => {
        const {id: maintainerDid} = maintainerDidDocumentFull.didDocument;
        const electorPoolDoc = _generateElectorPoolDoc();
        let operation = await _wrap(
          {didDocument: electorPoolDoc, operationType: 'create'});
        const key = _getMaintainerKeys();
        // no ledger write proof added
        // this proof is for writing to a single did
        operation = await attachInvocationProof({
          operation,
          capability: maintainerDid,
          capabilityAction: 'write',
          invocationTarget: operation.record.id,
          key,
          signer: key.signer()
        });

        const ledgerConfig = bedrock.util.clone(
          mockData.ledgerConfigurations.alpha);
        ledgerConfig.electorSelectionMethod = {
          type: 'VeresOne',
          // corresponds to electorPoolDocument.alpha
          electorPool: electorPoolDoc.id,
        };
        let err;
        let result;
        try {
          result = await voValidator.validate({
            basisBlockHeight: 0,
            ledgerConfig,
            ledgerNode,
            validatorInput: operation,
            validatorConfig: mockData.ledgerConfigurations.alpha
              .operationValidator[0]
          });
        } catch(e) {
          err = e;
        }
        assertNoError(err);
        result.valid.should.be.false;
        result.error.name.should.equal('ValidationError');
      });
      // FIXME add validation to ensure one of the proof's invocationTarget
      // is the ledger itself.
      it.skip('fails on op w/ two write capability proofs', async () => {
        const electorPoolDoc = _generateElectorPoolDoc();
        let operation = await _wrap(
          {didDocument: electorPoolDoc, operationType: 'create'});
        const key = _getMaintainerKeys();

        // no ledger write proof added
        // this operation has 2 write proofs with dids, but no
        // proof for writing to the ledger itself
        operation = await attachInvocationProof({
          operation,
          capability: electorPoolDoc.id,
          capabilityAction: 'write',
          invocationTarget: electorPoolDoc.id,
          key,
        });
        operation = await attachInvocationProof({
          operation,
          capability: electorPoolDoc.id,
          capabilityAction: 'write',
          invocationTarget: electorPoolDoc.id,
          key,
        });
        const ledgerConfig = bedrock.util.clone(
          mockData.ledgerConfigurations.alpha);
        ledgerConfig.electorSelectionMethod = {
          type: 'VeresOne',
          // corresponds to electorPoolDocument.alpha
          electorPool: electorPoolDoc.id,
        };
        let err;
        let result;
        try {
          result = await voValidator.validate({
            basisBlockHeight: 0,
            ledgerConfig,
            ledgerNode,
            validatorInput: operation,
            validatorConfig: mockData.ledgerConfigurations.alpha
              .operationValidator[0]
          });
        } catch(e) {
          err = e;
        }
        assertNoError(err);
        result.valid.should.be.false;
        result.error.name.should.equal('ValidationError');
      });
      // FIXME false negative here
      it('fails on op w/two ledger write capability proofs', async () => {
        const {id: maintainerDid} = maintainerDidDocumentFull.didDocument;
        const electorPoolDoc = _generateElectorPoolDoc();
        let operation = await _wrap(
          {didDocument: electorPoolDoc, operationType: 'create'});
        const key = _getMaintainerKeys();

        // we have 2 ledger write proofs, but no did specific
        // write proof
        operation = await attachInvocationProof({
          operation,
          algorithm: 'Ed25519Signature2020',
          capability: maintainerDid,
          capabilityAction: 'write',
          invocationTarget: maintainerDid,
          key,
        });
        operation = await attachInvocationProof({
          operation,
          algorithm: 'Ed25519Signature2020',
          capability: maintainerDid,
          capabilityAction: 'write',
          invocationTarget: operation.record.id,
          key,
        });
        const ledgerConfig = bedrock.util.clone(
          mockData.ledgerConfigurations.alpha);
        ledgerConfig.electorSelectionMethod = {
          type: 'VeresOne',
          // corresponds to electorPoolDocument.alpha
          electorPool: electorPoolDoc.id,
        };
        let err;
        let result;
        try {
          result = await voValidator.validate({
            basisBlockHeight: 0,
            ledgerConfig,
            ledgerNode,
            validatorInput: operation,
            validatorConfig: mockData.ledgerConfigurations.alpha
              .operationValidator[0]
          });
        } catch(e) {
          err = e;
        }
        assertNoError(err);
        result.valid.should.be.false;
        result.error.name.should.equal('ValidationError');
      });
      it('fails on op w/ incorrect capability DID', async () => {
        const electorPoolDoc = _generateElectorPoolDoc();
        let operation = await _wrap(
          {didDocument: electorPoolDoc, operationType: 'create'});
        const key = _getMaintainerKeys();

        // FIXME: add a write proof for the ledger that will pass json-schema
        // validation for testnet v2 *not* a valid signature
        operation.proof = bedrock.util.clone(mockData.proof);

        // replacing electorDid with maintainerDid
        operation = await attachInvocationProof({
          operation,
          // this DID document does not exist
          capability: 'did:v1:test:uuid:e798d4cf-f4f5-40cb-9f06-7fa56cf55d95',
          capabilityAction: 'write',
          invocationTarget: operation.record.id,
          key,
        });

        // FIXME: attach proof instead of mock proof above
        // operation = await attachInvocationProof(operation, {
        //   capability: maintainerDid,
        //   capabilityAction: 'write',
        //   key,
        // });
        const ledgerConfig = bedrock.util.clone(
          mockData.ledgerConfigurations.alpha);
        ledgerConfig.electorSelectionMethod = {
          type: 'VeresOne',
          // corresponds to electorPoolDocument.alpha
          electorPool: electorPoolDoc.id,
        };
        let err;
        let result;
        try {
          result = await voValidator.validate({
            basisBlockHeight: 0,
            ledgerConfig,
            ledgerNode,
            validatorInput: operation,
            validatorConfig: mockData.ledgerConfigurations.alpha
              .operationValidator[0]
          });
        } catch(e) {
          err = e;
        }
        assertNoError(err);
        result.valid.should.be.false;
        result.error.details.proofVerifyResult.verified.should.be.false;
        // the fictitious DID specified in the capability does not match the
        // this new document and is also not found on the ledger resulting in
        // a NotFoundError from the document loader.
        result.error.details.proofVerifyResult.results[0].error.name
          .should.equal('NotFoundError');
        result.error.name.should.equal('ValidationError');
      });
    }); // end create electorPool operation

    describe('update electorPool operation', () => {
      it('validates an operation with proper proof', async () => {
        const {id: electorDid} = electorDidDocumentFull.didDocument;
        const {id: maintainerDid} = maintainerDidDocumentFull.didDocument;
        const electorPoolDoc = bedrock.util.clone(
          mockData.electorPoolDocument.alpha);
        electorPoolDoc.electorPool[0].elector = electorDid;
        electorPoolDoc.electorPool[0].service = electorServiceId;
        electorPoolDoc.electorPool[0].capability[0].id = maintainerDid;
        // the invocationTarget is the ledger ID
        electorPoolDoc.electorPool[0].capability[0].invocationTarget =
          'urn:uuid:e9e63a07-15b1-4e8f-b725-a71a362cfd99';
        electorPoolDoc.controller = maintainerDid;
        ldDocuments.set(electorPoolDoc.id, bedrock.util.clone(electorPoolDoc));
        const observer = jsonpatch.observe(electorPoolDoc);
        const elector =
          'did:v1:test:nym:z279squ73dJ3q21jAEk3FRrr37UdX5xo8FXWA74anmPnvzfx';

        // FIXME: should inline serviceIds be did: URI's?
        const newServiceId = `${elector};service=TheServiceId`;

        const newServiceEndpoint = mockData.electorEndpoint[1];
        const {capability} = electorPoolDoc.electorPool[0];
        // using an inline service descriptor
        electorPoolDoc.electorPool.push({
          // elector DID is not dereferenced in this case
          elector,
          capability,
          id: _generateUrnUuid(),
          type: ['Continuity2017GuarantorElector', 'Continuity2017Elector'],
          service: {
            id: newServiceId,
            serviceEndpoint: newServiceEndpoint,
            type: continuityServiceType,
          },
        });
        const patch = jsonpatch.generate(observer);

        let operation = {
          '@context': constants.WEB_LEDGER_CONTEXT_V1_URL,
          creator: 'https://example.com/some/ledger/node',
          recordPatch: {
            '@context': mockData.patchContext,
            patch,
            sequence: 0,
            target: electorPoolDoc.id,
          },
          type: 'UpdateWebLedgerRecord',
        };

        const key = _getMaintainerKeys();

        // FIXME: what are proper proofs for an update operation?

        // FIXME: add a write proof for the ledger that will pass json-schema
        // validation for testnet v2 *not* a valid signature
        operation.proof = bedrock.util.clone(mockData.proof);

        operation = await attachInvocationProof({
          operation,
          capability: electorPoolDoc.id,
          // capabilityAction: operation.type,
          capabilityAction: 'write',
          invocationTarget: operation.recordPatch.target,
          key,
        });
        // FIXME: replace mock proof above with legitimate proof
        // operation = await attachInvocationProof(operation, {
        //   capability: maintainerDid,
        //   // capabilityAction: operation.type,
        //   capabilityAction: 'write',
        //   key,
        // });
        const ledgerConfig = bedrock.util.clone(
          mockData.ledgerConfigurations.alpha);
        ledgerConfig.electorSelectionMethod = {
          type: 'VeresOne',
          // corresponds to electorPoolDocument.alpha
          electorPool: electorPoolDoc.id,
        };
        let err;
        let result;
        try {
          result = await voValidator.validate({
            basisBlockHeight: 0,
            ledgerConfig,
            ledgerNode,
            validatorInput: operation,
            validatorConfig: mockData.ledgerConfigurations.alpha
              .operationValidator[0]
          });
        } catch(e) {
          err = e;
        }
        assertNoError(err);
        assertNoError(result.error);
        result.valid.should.be.true;
      });
      it('rejects an operation removing electorPool', async () => {
        const {id: electorDid} = electorDidDocumentFull.didDocument;
        const {id: maintainerDid} = maintainerDidDocumentFull.didDocument;
        const electorPoolDoc = bedrock.util.clone(
          mockData.electorPoolDocument.alpha);
        electorPoolDoc.electorPool[0].elector = electorDid;
        electorPoolDoc.electorPool[0].service = electorServiceId;
        electorPoolDoc.electorPool[0].capability[0].id = maintainerDid;
        // the invocationTarget is the ledger ID
        electorPoolDoc.electorPool[0].capability[0].invocationTarget =
          'urn:uuid:e9e63a07-15b1-4e8f-b725-a71a362cfd99';
        electorPoolDoc.controller = maintainerDid;
        ldDocuments.set(electorPoolDoc.id, bedrock.util.clone(electorPoolDoc));
        const observer = jsonpatch.observe(electorPoolDoc);

        delete electorPoolDoc.electorPool;

        const patch = jsonpatch.generate(observer);

        let operation = {
          '@context': constants.WEB_LEDGER_CONTEXT_V1_URL,
          creator: 'https://example.com/some/ledger/node',
          recordPatch: {
            '@context': mockData.patchContext,
            patch,
            sequence: 0,
            target: electorPoolDoc.id,
          },
          type: 'UpdateWebLedgerRecord',
        };

        const key = _getMaintainerKeys();

        // FIXME: what are proper proofs for an update operation?

        // FIXME: add a write proof for the ledger that will pass json-schema
        // validation for testnet v2 *not* a valid signature
        operation.proof = bedrock.util.clone(mockData.proof);

        operation = await attachInvocationProof({
          operation,
          capability: electorPoolDoc.id,
          // capabilityAction: operation.type,
          capabilityAction: 'write',
          invocationTarget: operation.recordPatch.target,
          key,
        });
        // FIXME: replace mock proof above with legitimate proof
        // operation = await attachInvocationProof(operation, {
        //   capability: maintainerDid,
        //   // capabilityAction: operation.type,
        //   capabilityAction: 'write',
        //   key,
        // });
        const ledgerConfig = bedrock.util.clone(
          mockData.ledgerConfigurations.alpha);
        ledgerConfig.electorSelectionMethod = {
          type: 'VeresOne',
          // corresponds to electorPoolDocument.alpha
          electorPool: electorPoolDoc.id,
        };
        let err;
        let result;
        try {
          result = await voValidator.validate({
            basisBlockHeight: 0,
            ledgerConfig,
            ledgerNode,
            validatorInput: operation,
            validatorConfig: mockData.ledgerConfigurations.alpha
              .operationValidator[0]
          });
        } catch(e) {
          err = e;
        }
        assertNoError(err);
        result.valid.should.be.false;
        should.exist(result.error);
        result.error.name.should.equal('ValidationError');
        result.error.message.should.contain('ElectorPool Document');
      });
    }); // end update electorPool operation
  });
});

function _generateElectorPoolDoc() {
  const {id: electorDid} = electorDidDocumentFull.didDocument;
  const {id: maintainerDid} = maintainerDidDocumentFull.didDocument;
  const electorPoolDoc = bedrock.util.clone(
    mockData.electorPoolDocument.alpha);
  electorPoolDoc.electorPool[0].elector = electorDid;
  electorPoolDoc.electorPool[0].service = electorServiceId;
  electorPoolDoc.electorPool[0].capability[0].id = maintainerDid;
  // the invocationTarget is the ledger ID
  electorPoolDoc.electorPool[0].capability[0].invocationTarget =
    'urn:uuid:e9e63a07-15b1-4e8f-b725-a71a362cfd99';
  electorPoolDoc.controller = maintainerDid;
  return electorPoolDoc;
}

function _generateUrnUuid() {
  return `urn:uuid:${uuid()}`;
}

function _getMaintainerKeys() {
  const invokePublicKey =
    maintainerDidDocumentFull.didDocument.capabilityInvocation[0];
  return maintainerDidDocumentFull.keyPairs.get(invokePublicKey.id);
}

// this is a modified version of the wrap API found in did-veres-one and
// web-ledger-client
async function _wrap({didDocument, operationType = 'create'}) {
  const operation = {'@context': constants.WEB_LEDGER_CONTEXT_V1_URL};

  // normally this is set basted on the targetNode value provided by the
  // ledger-agent HTTP API
  operation.creator = 'https://example.com/some/ledger/node';

  switch(operationType) {
    case 'create':
      operation.type = 'CreateWebLedgerRecord';
      operation.record = didDocument;
      break;
    case 'update':
      operation.type = 'UpdateWebLedgerRecord';
      operation.recordPatch = didDocument;
      break;
    default:
      throw new BedrockError(
        'Unknown operation type.', 'SyntaxError', {operationType});
  }

  return operation;
}
