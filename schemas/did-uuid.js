/*!
 * Copyright (c) 2017-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const bedrock = require('bedrock');
const {config} = bedrock;
require('../lib/config');

const cfg = config['veres-one-validator'];

const prefix = cfg.environment === 'test' ? 'did:v1:test' : 'did:v1';
/* eslint-disable-next-line max-len */
const pattern = `^${prefix}:uuid:([a-fA-F0-9]{8}-[a-fA-F0-9]{4}-4[a-fA-F0-9]{3}-[89abAB][a-fA-F0-9]{3}-[a-fA-F0-9]{12})$`;
// prefix can be 11 chars or 6 chars for a total of 53 or 48
const expectedLength = prefix.length + 42;

const schema = {
  title: 'DID UUID',
  type: 'string',
  pattern,
  minLength: expectedLength,
  maxLength: expectedLength
};

module.exports = () => schema;
