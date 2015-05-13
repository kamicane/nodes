"use strict";

var spec = require("../spec.json");
var typeOf = require("../util/type-of");

// # util

var create = Object.create;
var define = Object.defineProperty;

// # descriptors

var f = function(value) { // frozen
  return { value: value, enumerable: false, configurable: false, writable: false };
};

var e = function(value) { // enum
  return { value: value, enumerable: true, configurable: false, writable: false };
};

var ecw = function(value) { // enum, config, write
  return { value: value, enumerable: true, configurable: true, writable: true };
};

var cw = function(value) { // config, write
  return { value: value, enumerable: false, configurable: true, writable: true };
};

var w = function(value) { // write
  return { value: value, enumerable: false, configurable: false, writable: true };
};

var gc = function(value) { // get, config
  return { get: value, enumerable: false, configurable: true };
};

// # inherits walk

var instanceOf = function(type, test) {
  if (type === test) return true;

  var description = spec[type];
  var inherits = description.inherits;

  if (inherits) for (var i = 0; i < inherits.length; i++) {
    var name = inherits[i];
    if (instanceOf(name, test)) return true;
  }

  return false;
};

var combinedKeys = function(type) {
  var description = spec[type];
  var inherits = description.inherits;

  var keys = {}, k;

  if (inherits) for (var i = 0; i < inherits.length; i++) {
    var superKeys = combinedKeys(inherits[i]);
    for (k in superKeys) keys[k] = superKeys[k];
  }

  var selfKeys = description.keys;

  if (selfKeys) for (k in selfKeys) keys[k] = selfKeys[k];

  return keys;
};

var kindOf = function(type) {
  var description = spec[type];

  if (description.kind) return description.kind;

  var inherits = description.inherits;

  var kind;

  if (inherits) for (var l = inherits.length; l--; l) {
    kind = kindOf(inherits[l]);
    if (kind) return kind;
  }

  return null;
};

// # collections

var types = create(null);
var lists = create(null);
var syntax = create(null);

// # validators

var validators = create(null);

var validatorName = function(accepts) {
  return accepts.map(function(name) {
    return (name === null) ? "Null" : name;
  }).join("|");
};

var createNodeValidator = function(accepts) {

  var name = validatorName(accepts);

  return validators[name] || (validators[name] = function(node) {
    if (node === undefined) return !!~accepts.indexOf(undefined);
    if (node === null) return !!~accepts.indexOf(null);

    if (!node.isNode) return false;

    var nodeType = node.type;

    for (var i = 0; i < accepts.length; i++) {
      var type = accepts[i];
      if (instanceOf(nodeType, type)) return true;
    }

    return false;
  });
};

var createStrictValidator = function(accepts) {

  var name = validatorName(accepts);

  return validators[name] || (validators[name] = function(match) {
    for (var i = 0; i < accepts.length; i++) {
      var value = accepts[i];
      if (match === value) return true;
    }

    return false;
  });
};

var createNativeValidator = function(accepts) {

  var name = validatorName(accepts);

  return validators[name] || (validators[name] = function(match) {
    var matchType = typeOf(match);

    for (var i = 0; i < accepts.length; i++) {
      var type = accepts[i];
      if (type === null && matchType === "Null") return true;
      else if (matchType === type) return true;
    }

    return false;
  });
};

// accessors

var createAccessorDescriptor = function(key, validate, defaultValue) {
  var privateName = "@" + key;

  return {
    enumerable: true,
    configurable: false,

    get: function() {
      return this[privateName] !== undefined ? this[privateName] : defaultValue;
    },

    set: function(value) {
      if (value !== undefined && !validate(value)) throw new TypeError("invalid value (" + value + ") for " + key + " in " + this.type);
      var previous = this[privateName];
      if (previous && (previous.isNode || previous.isList)) previous.parentNode = undefined;
      if (value && (value.isNode || value.isList)) {
        var parentNode = value.parentNode;
        if (parentNode) parentNode.removeChild(value);
        value.parentNode = this;
      }

      return this[privateName] = value;
    }

  };
};

var createNodeAccessor = function(proto, key, accepts) {
  var validate = createNodeValidator(accepts);

  var defaultValue;
  if (~accepts.indexOf(null)) defaultValue = null;

  define(proto, key, createAccessorDescriptor(key, validate, defaultValue));
};

var createNativeAccessor = function(proto, key, accepts) {
  var validate = createNativeValidator(accepts);

  var defaultValue;
  if (~accepts.indexOf(null)) defaultValue = null;

  else if (validatorName(accepts) === "Boolean") defaultValue = false;

  define(proto, key, createAccessorDescriptor(key, validate, defaultValue));
};

var createStrictAccessor = function(proto, key, accepts) {
  var validate = createStrictValidator(accepts);
  define(proto, key, createAccessorDescriptor(key, validate));
};

// # Base Classes

var rootGetter = gc(function() {
  var parent = this.parentNode;

  while (parent) {
    var ancestor = parent.parentNode;
    if (!ancestor) return parent;
    parent = ancestor;
  }
});

// # Node

var UID = 0;

function Node() {
  define(this, "uid", f((UID++).toString(36)));
  define(this, "parentNode", w(undefined));
}

Node.prototype = create({}, {

  constructor: f(Node),
  isNode: f(true),

  instanceOf: cw(function(NodeClass) {
    var type = NodeClass.prototype.type;
    var thisType = this.type;

    return instanceOf(thisType, type);
  }),

  removeChild: cw(function(child) {
    var key = this.indexOf(child);
    if (key != null) this[key] = undefined;
    return this;
  }),

  replaceChild: cw(function(child, value) {
    var key = this.indexOf(child);
    if (key != null) this[key] = value;
    return this;
  }),

  indexOf: cw(function(value) {
    for (var key in this) {
      if (this[key] === value) return key;
    }
    return null;
  }),

  toJSON: cw(function() {
    var object = {};

    for (var key in this) {
      var value = this[key];
      if (value && value.toJSON) value = value.toJSON();
      if (value !== undefined) object[key] = value;
    }

    return object;
  }),

  toString: cw(function() {
    return JSON.stringify(this, null, 2);
  }),

  traverse: cw(function(visitor, deep) {
    var found, skip = {};

    var keys = this.constructor.keys;

    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];

      var value = this[key];

      found = visitor.call(this, value, key, skip);
      if (found === skip) continue;
      if (found !== undefined) break;
      if (deep && value && (value.isNode || value.isList)) {
        found = value.traverse(visitor, deep);
        if (found !== undefined) break;
      }
    }

    return found;
  }),

  root: rootGetter

});

// # BaseList

function BaseList() {
  define(this, "length", w(0));
}

BaseList.prototype = create(Array.prototype, {

  constructor: f(BaseList),
  isList: f(true),

  removeChild: cw(function(child) {
    var io = this.indexOf(child);
    if (io > -1) this.splice(io, 1);
    return this;
  }),

  replaceChild: cw(function(child, value) {
    var io = this.indexOf(child);
    if (io > -1) this.splice(io, 1, value);
    return this;
  }),

  toJSON: cw(function() {
    var array = [];
    for (var i = 0; i < this.length; i++) {
      var value = this[i];
      if (value && value.toJSON) value = value.toJSON();
      array.push(value);
    }
    return array;
  }),

  empty: cw(function() {
    return this.splice(0, this.length);
  }),

  toString: cw(function() {
    return JSON.stringify(this, null, 2);
  }),

  traverse: cw(function(visitor, deep) {
    var found, skip = {};

    for (var i = 0; i < this.length; i++) {
      var node = this[i];
      found = visitor.call(this, node, i, skip);
      if (found === skip) continue;
      if (found !== void 0) break;
      if (deep && node && node.traverse) {
        found = node.traverse(visitor, deep);
        if (found !== void 0) break;
      }
    }

    return found;
  }),

  forEachRight: cw(function(visitor, ctx) {
    for (var i = this.length; i--; i) {
      visitor.call(ctx, this[i], i, this);
    }
  }),

  slice: cw(function() {
    var list = new BaseList;
    for (var i = 0; i < this.length; i++) list.push(this[i]);
    return list;
  }),

  filter: cw(function(method, ctx) {
    var list = new BaseList;
    for (var i = 0; i < this.length; i++) {
      var value = this[i];
      if (method.call(ctx, value, i, this)) list.push(value);
    }
    return list;
  }),

  append: cw(function(array) {
    this.push.apply(this, array);
    return this;
  }),

  root: rootGetter

});

// # List

function setNodeList(list, node) {

  if (!list.validate(node)) {
    throw new TypeError("invalid list item (" + node + ") on " + list.type);
  }

  // lists only accept Nodes and NULL, always.
  if (node) {
    var parentNode = node.parentNode;
    if (parentNode) parentNode.removeChild(node);
    node.parentNode = list;
  }

  return node;
}

function unsetNodeList(node) {
  if (node) node.parentNode = undefined;
  return node;
}

function List(parentNode) {
  define(this, "parentNode", f(parentNode));
  define(this, "uid", f((UID++).toString(36)));
  BaseList.call(this);
}

List.prototype = create(BaseList.prototype, {

  constructor: f(List),

  splice: cw(function(index, howMany) {
    if (index > this.length) return [];

    var nodes = [], node;

    for (var i = 2; i < arguments.length; i++) {
      node = setNodeList(this, arguments[i]);
      nodes.push(node);
    }

    for (var j = index; j < howMany; j++) unsetNodeList(this[j]);

    return Array.prototype.splice.apply(this, [index, howMany].concat(nodes));
  }),

  push: cw(function() {
    var nodes = [];
    for (var i = 0; i < arguments.length; i++) nodes.push(setNodeList(this, arguments[i]));
    return Array.prototype.push.apply(this, nodes);
  }),

  pop: cw(function() {
    return unsetNodeList(Array.prototype.pop.call(this));
  }),

  shift: cw(function() {
    return unsetNodeList(Array.prototype.shift.call(this));
  }),

  unshift: cw(function() {
    var nodes = [];
    for (var i = 0; i < arguments.length; i++) nodes.push(setNodeList(this, arguments[i]));
    return Array.prototype.unshift.apply(this, nodes);
  })

});

// #defineNodeList

var listName = function(type, key) {
  return type + key.replace(/^\w/, function(f) {
    return f.toUpperCase();
  });
};

var defineNodeList = function(type, key, accepts) {
  var name = listName(type, key);

  var validate = createNodeValidator(accepts);

  // this eval is to define the function name at runtime.
  var SubList = new Function("List",
    "return function " + name + "() {" +
      "List.apply(this, arguments);" +
    "};"
  )(List);

  SubList.prototype = create(List.prototype, {
    constructor: f(SubList),
    type: f(name),
    validate: cw(validate)
  });

  define(lists, name, ecw(SubList));

  return SubList;
};

// # defineNode

function defineNode(type) {

  var keys = combinedKeys(type);

  var constructor = function(init) {
    if (!init) init = {};

    var key;

    // custom keys
    for (key in init) {
      if (key in keys) continue;
      this[key] = init[key];
    }

    for (key in keys) {
      var desc = keys[key];
      var value = init[key];

      switch (desc.kind) {
        case "list":
          var list = new lists[listName(type, key)](this);
          define(this, key, e(list));
          if (value !== undefined) list.push.apply(list, value);
        break;
        default: // native, strict, node
          define(this, "@" + key, w(undefined));
          if (value !== undefined) this[key] = value;
        break;
      }
    }

    Node.call(this);
  };

  // this eval is to define the function name at runtime.
  var SubNode = new Function("constructor",
    "return function " + type + "() {" +
      "constructor.apply(this, arguments);" +
    "};"
  )(constructor);

  define(SubNode, "keys", f(Object.keys(keys)));

  var proto = SubNode.prototype = create(Node.prototype, {
    constructor: f(SubNode),
    type: e(type)
  });

  define(types, type, ecw(SubNode));

  for (var key in keys) {
    var desc = keys[key];
    var accepts = desc.accepts;

    switch (desc.kind) {
      case "list":
        defineNodeList(type, key, accepts);
      break;
      case "node":
        createNodeAccessor(proto, key, accepts);
      break;
      case "native":
        createNativeAccessor(proto, key, accepts);
      break;
      case "strict":
        createStrictAccessor(proto, key, accepts);
      break;
    }
  }

  return SubNode;
}


for (var type in spec) {
  defineNode(type);
  define(syntax, type, e(type));
}

exports.instanceOf = function(node, NodeClass) {
  if (!node || !node.isNode) return false;
  return node.instanceOf(NodeClass);
};

exports.Node = Node;
exports.BaseList = BaseList;
exports.List = List;

exports.syntax = syntax;

exports.types = types;
exports.lists = lists;
