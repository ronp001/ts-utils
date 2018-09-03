"use strict";

var _index = require("../index");

///<reference types="jest"/>
test('similar', function () {
  expect(_index.StrUtils.isSimilar('a', 'b')).toBeFalsy();
  expect(_index.StrUtils.isSimilar('Hello', 'hello')).toBeTruthy();
  expect(_index.StrUtils.isSimilar('Hello-There', 'hello_there')).toBeTruthy();
  expect(_index.StrUtils.isSimilar('HELLO__THERE', 'hellothere')).toBeTruthy();
  expect(_index.StrUtils.isSimilar('Hello There', 'hello_there')).toBeTruthy();
  expect(_index.StrUtils.isSimilar('   Hello There  ', 'hello_there')).toBeTruthy();
  expect(_index.StrUtils.isSimilar('Hello There!', 'hello there')).toBeFalsy();
  expect(_index.StrUtils.isSimilar('Hello.There', 'hello there')).toBeFalsy();
  expect(_index.StrUtils.isSimilar('Hello   There!', 'hello there')).toBeFalsy();
});