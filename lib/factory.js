'use strict';

var typeOf = require('./type-of');

// # util

var create = Object.create;
var define = Object.defineProperty;

var expect = function() {
  var args = arguments;
  return { test: function(item) {
    for (var i = 0; i < args.length; i++) {
      var check = args[i];
      if (check === null) {
        if (item === null) return true;
      } else if (check.test(item)) {
        return true;
      }
    }
    return false;
  } };
};

// # descriptors

var f = function(value) { // frozen
  return { value: value, enumerable: true, configurable: false, writable: false };
};

var d = function(value) { // non enumerable
  return { value: value, enumerable: false, configurable: true, writable: true };
};

var p = function(value) { // protected
  return { value: value, enumerable: false, configurable: false, writable: false };
};

var g = function(value) {
  return { get: value, enumerable: false, configurable: true };
};

// # interface

var listGetter = function(type, key, test) {

  var listName = type + key.replace(/^\w/, function(f) {
    return f.toUpperCase();
  });

  var SubList = new Function('List', 'return function ' + listName + '(){ List.apply(this, arguments); }')(List);

  List[listName] = SubList;

  SubList.prototype = create(List.prototype, {
    constructor: p(SubList)
  });

  SubList.test = function(item) {
    return item instanceof SubList;
  };

  SubList.accept = test && test.test;

  var name = '@' + key;

  return {

    get: function() {
      if (!(name in this)) define(this, name, p(new SubList(this)));
      return this[name];
    },

    set: function() {
      throw new Error('cannot set ' + key + ' list');
    },

    enumerable: true,
    configurable: false
  };
};

var propertyAccessor = function(key, test) { // accessor

  var name = '@' + key;

  return {

    get: function() {
      return this[name];
    },

    set: function(value) {
      if (test && !test.test(value)) {
        var message = 'the value ' + ((value && value.type) || value) +
        ' does not meet the criteria for the key ' + key + ' on node ' + this.type;
        throw new TypeError(message);
      }

      if (name in this) { // clear previous
        var previous = this[name];
        if (previous instanceof Node) previous.remove();
      }

      if (value && value !== this[name] && value instanceof Node) {
        value.remove();
        define(value, 'parentNode', d(this));
      }

      define(this, name, d(value));
      return value;
    },

    enumerable: true,
    configurable: false
  };

};

function describe(SuperNode, description) {

  var type = description.type;

  var SubNode = new Function('SuperNode',
    'return function ' + type + '() {' +
      'SuperNode.apply(this, arguments);' +
    '}'
  )(SuperNode);

  SubNode.test = function(item) {
    return item instanceof SubNode;
  };

  var descriptors = {
    constructor: p(SubNode),
    type: f(type)
  };

  var keys = Object.keys(description);

  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (/type/.test(key)) continue;
    var field = description[key];

    var nativeType = typeOf(field);

    if (nativeType === 'Array') {
      descriptors[key] = listGetter(type, key, expect.apply(null, field));
    } else if (nativeType === 'Object' || nativeType === 'RegExp') {
      descriptors[key] = propertyAccessor(key, field);
    }
  }

  keys.push('loc');

  SubNode.keys = keys;

  SubNode.prototype = create(SuperNode.prototype, descriptors);

  return SubNode;
}

// # BaseList

var rootMe = g(function() {
  var parent = this.parentNode;

  while (parent) {
    var ancestor = parent.parentNode;
    if (!ancestor) return parent;
    parent = ancestor;
  }
});

function BaseList() {
  this.length = 0;
};

BaseList.prototype = create(Array.prototype, {

  constructor: p(BaseList),

  toJSON: d(function() {
    var array = [];
    for (var i = 0; i < this.length; i++) {
      var value = this[i];
      if (value && value.toJSON) value = value.toJSON();
      array.push(value);
    }
    return array;
  }),

  empty: d(function() {
    return this.splice(0, this.length);
  }),

  toString: d(function() {
    return JSON.stringify(this, null, 2);
  }),

  traverse: d(function(visitor, deep) {
    var found;

    for (var i = 0; i < this.length; i++) {
      var node = this[i];
      found = visitor(node, i);
      if (found !== void 0) break;
      if (deep && node) {
        found = node.traverse(visitor, deep);
      }
      if (found !== void 0) break;
    }

    return found;
  }),

  root: rootMe

});

BaseList.test = function(item) {
  return item instanceof BaseList;
};

// # List

function setNodeParent(node, parent) {
  var test = parent.constructor.accept;

  if (test && !test(node)) {
    throw new TypeError('the list ' + parent.constructor.name + ' does not accept ' + node);
  }

  if (node) {
    node.remove();
    define(node, 'parentNode', d(parent));
  }

  return node;
}

function unsetNodeParent(node) {
  if (node) delete node.parentNode;
  return node;
}

function List(parent) {
  define(this, 'parentNode', p(parent));
  BaseList.call(this);
}

List.prototype = create(BaseList.prototype, {

  constructor: p(List),

  splice: d(function(index, howMany) {
    if (index > this.length) return [];

    var nodes = [], node;

    for (var i = 2; i < arguments.length; i++) {
      node = setNodeParent(arguments[i], this);
      nodes.push(node);
    }

    for (var j = index; j < howMany; j++) unsetNodeParent(this[j]);

    return Array.prototype.splice.apply(this, [index, howMany].concat(nodes));
  }),

  push: d(function() {
    for (var i = 0; i < arguments.length; i++) setNodeParent(arguments[i], this);
    return Array.prototype.push.apply(this, arguments);
  }),

  pop: d(function() {
    return unsetNodeParent(Array.prototype.pop.call(this));
  }),

  shift: d(function() {
    return unsetNodeParent(Array.prototype.shift.call(this));
  }),

  unshift: d(function() {
    for (var i = 0; i < arguments.length; i++) setNodeParent(arguments[i], this);
    return Array.prototype.unshift.apply(this, arguments);
  })

});

List.test = function(item) {
  return item instanceof List;
};

// # Node

var UID = 0;

function Node() {
  define(this, 'uid', p((UID++).toString(36)));
}

Node.prototype = create({}, {

  constructor: p(Node),

  remove: d(function() {
    var parent = this.parentNode;
    if (!parent) return this;

    if (parent instanceof Node) {
      delete parent['@' + parent.indexOf(this)];
      delete this.parentNode;
    } else if (parent instanceof List) {
      parent.splice(parent.indexOf(this), 1);
    }
    return this;
  }),

  toJSON: d(function() {
    var properties = {};
    var keys = this.constructor.keys;

    for (var i = 0; i < keys.length; i++) {
      var key = keys[i], value = this[key];
      if (value && value.toJSON) value = value.toJSON();
      if (value !== void 0) properties[key] = value;
    }

    return properties;
  }),

  toString: d(function() {
    return JSON.stringify(this, null, 2);
  }),

  traverse: d(function(visitor, deep) {
    var found;

    var keys = this.constructor.keys;

    for (var i = 0; i < keys.length; i++) {
      var key = keys[i], value = this[key];
      if (key === 'loc') continue; // do not traverse loc

      found = visitor(value, key);
      if (found !== void 0) break;
      if (deep && (value instanceof Node || value instanceof List)) {
        found = value.traverse(visitor, deep);
      }
      if (found !== void 0) break;
    }

    return found;
  }),

  indexOf: d(function(value) {
    for (var key in this) if (this[key] === value) return key;
  }),

  root: rootMe

});

Node.test = function(item) {
  return item instanceof Node;
};

exports.Node = Node;
exports.List = List;
exports.BaseList = BaseList;

exports.p = p;
exports.f = f;
exports.d = d;
exports.g = g;

exports.describe = describe;
exports.expect = expect;
