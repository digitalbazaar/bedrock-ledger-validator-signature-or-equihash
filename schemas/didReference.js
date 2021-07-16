/*!
 * Copyright (c) 2017-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const bedrock = require('bedrock');

const {config} = bedrock;
require('../lib/config');

const cfg = config['veres-one-validator'];

// a did reference contains an anchor tag `#`
const pattern = cfg.environment === 'test' ?
  '^(did\:v1\:test\:nym\:)(z[-_A-Za-z0-9.]+)#(z[-_A-Za-z0-9.]+)$' :
  '^(did\:v1\:nym\:)(z[-_A-Za-z0-9.]+)#(z[-_A-Za-z0-9.]+)$';

const schema = {
  title: 'Decentralized Identifier',
  description: 'A decentralized identifier.',
  type: 'string',
  pattern,
  minLength: cfg.environment === 'test' ? 17 : 12,
  // prefix max length is 16 + 2x publicKeyMultibase (48 each) and
  // a # in the middle for 113 characters
  maxLength: 113,
  errors: {
    invalid: 'The decentralized identifier reference is invalid.',
    missing: 'Please provide a decentralized identifier reference.'
  }
};

module.exports = () => schema;
