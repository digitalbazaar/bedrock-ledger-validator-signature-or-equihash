/*!
 * Copyright (c) 2017-2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const _ = require('lodash');
const bedrock = require('bedrock');
const brLedgerNode = require('bedrock-ledger-node');
const {validate} = require('bedrock-validation');
require('bedrock-ledger-context');
require('bedrock-veres-one-context');

require('./config');
const _validators = require('./validators');

const api = {};
module.exports = api;

bedrock.events.on('bedrock.start', () =>
  brLedgerNode.use('VeresOneValidator2017', {api, type: 'validator'}));

api.mustValidate = async ({validatorConfig, validatorInput}) => {
  const result = await api.validateConfiguration({validatorConfig});
  if(!result.valid) {
    throw result.error;
  }
  if(validatorInput.type === 'WebLedgerConfiguration') {
    return true;
  }
  if(validatorConfig.validatorFilter &&
    !validatorConfig.validatorFilter.some(f =>
      f.type === 'ValidatorFilterByType' &&
      f.validatorFilterByType.includes(validatorInput.type))) {
    return false;
  }
  return true;
};

api.validateConfiguration = async ({validatorConfig}) => {
  return validate('veres-one-validator.validatorConfig', validatorConfig);
};

api.validate = async ({
  ledgerConfig = {}, ledgerNode, validatorConfig, validatorInput,
  basisBlockHeight
} = {}) => {
  if(!ledgerNode) {
    throw new TypeError('"ledgerNode" must be a LedgerNode instance.');
  }
  // allow basisBlockHeight === undefined for the genesis ledger configuration
  if(basisBlockHeight === undefined &&
    ((validatorInput.type !== 'WebLedgerConfiguration') ||
    (validatorInput.type === 'WebLedgerConfiguration' &&
      validatorInput.sequence > 0))
  ) {
    throw new TypeError('"basisBlockHeight" must be an integer >= 0.');
  }

  if(validatorInput.type === 'WebLedgerConfiguration') {
    return _validators.webLedgerConfiguration({ledgerNode, validatorInput});
  }

  let result = validate('veres-one-validator.operation', validatorInput);
  if(!result.valid) {
    return result;
  }

  result = await _validators.proofs(
    {basisBlockHeight, ledgerNode, validatorInput});
  if(!result.valid) {
    return result;
  }

  const electorPool = _.get(ledgerConfig, 'witnessSelectionMethod.electorPool');
  const {validatorParameterSet} = validatorConfig;

  if(validatorInput.type === 'CreateWebLedgerRecord') {
    return _validators.createWebLedgerRecord({
      basisBlockHeight, electorPool, ledgerNode, validatorInput,
      validatorParameterSet
    });
  }
  // must be an UpdateWebLedgerRecord op
  return _validators.updateWebLedgerRecord({
    basisBlockHeight, electorPool, ledgerNode, validatorInput,
    validatorParameterSet
  });
};
