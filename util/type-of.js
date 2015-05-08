"use strict";

function typeOf(object) {
  if (object === void 0) return "Undefined";
  if (object === null) return "Null";
  return object.constructor.name;
}

typeOf.String = function(item) {
  return typeOf(item) === "String";
};

typeOf.Object = function(item) {
  return typeOf(item) === "Object";
};

typeOf.Number = function(item) {
  return typeOf(item) === "Number";
};

typeOf.RegExp = function(item) {
  return typeOf(item) === "RegExp";
};

typeOf.Boolean = function(item) {
  return typeOf(item) === "Boolean";
};

typeOf.Function = function(item) {
  return typeOf(item) === "Function";
};

typeOf.Array = function(item) {
  return typeOf(item) === "Array";
};

module.exports = typeOf;

