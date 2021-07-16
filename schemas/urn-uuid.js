/*!
 * Copyright (c) 2017-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

/* eslint-disable-next-line max-len */
const pattern = '^urn:uuid:([a-fA-F0-9]{8}-[a-fA-F0-9]{4}-4[a-fA-F0-9]{3}-[89abAB][a-fA-F0-9]{3}-[a-fA-F0-9]{12})$';
const expectedLength = 45;

const schema = {
  title: 'URN UUID',
  type: 'string',
  pattern,
  minLength: expectedLength,
  maxLength: expectedLength
};

module.exports = () => schema;
