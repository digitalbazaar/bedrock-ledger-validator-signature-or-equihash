/*!
 * Copyright (c) 2017-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const bedrock = require('bedrock');
const {config} = bedrock;
require('../lib/config');

const cfg = config['veres-one-validator'];
const prefix = cfg.environment === 'test' ? 'did:v1:test' : 'did:v1';
const pattern = `^(${prefix}:nym:)([-_A-Za-z0-9.]+)$`;
// prefix + :nym:
const minLength = prefix.length + 5;

const schema = {
  title: 'Decentralized Identifier',
  description: 'A decentralized identifier.',
  type: 'string',
  pattern,
  minLength,
  // prefix plus a single multibase base58 encoded multicodec public key
  maxLength: minLength + 48,
  errors: {
    invalid: 'The decentralized identifier is invalid.',
    missing: 'Please enter a decentralized identifier.'
  }
};

module.exports = () => schema;
