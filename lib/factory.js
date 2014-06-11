'use strict';

var typeOf = require('../util/type-of');

// # util

var create = Object.create;
var define = Object.defineProperty;

function expect() {
  var self = {};
  var tests = arguments;

  self.test = function(item) {
    for (var i = 0; i < tests.length; i++) {
      var test = tests[i];
      if (test === null) {
        if (item === null) return true;
      } else if (test.test(item)) {
        return true;
      }
    }
    return false;
  };

  self.default = function(value) {
    self.defaultValue = value;
    return self;
  };

  return self;
}

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

  // the eval here is to assign a dynamic name to the function
  // which also works with ./util/type-of
  var SubList = new Function('List',
    'return function ' + listName + '() {' +
      'List.apply(this, arguments);' +
    '};'
  )(List);

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
      throw new Error('cannot reset ' + key + ' on ' + this.constructor.name);
    },

    enumerable: true,
    configurable: false
  };
};

var propertyAccessor = function(key, field) { // accessor

  var name = '@' + key;

  return {

    get: function() {
      if (!(name in this)) {
        var defaultValue = field.defaultValue;
        if (defaultValue !== void 0) {
          define(this, name, d(defaultValue));
          return defaultValue;
        }
      }
      return this[name];
    },

    set: function(value) {
      if (typeOf(value) === 'Object') value = build(value);

      if (!field.test(value)) {
        var message = 'invalid value: ' + (value && value.type) + ' for "' + key + '" on ' + this.type;
        throw new TypeError(message);
      }

      var previous = this[name];
      if (previous) delete previous.parentNode;

      if (value) {
        if (value.parentNode) value.parentNode.removeChild(value);
        if (value instanceof Node || value instanceof List) define(value, 'parentNode', d(this));
      }

      define(this, name, d(value));
      return value;
    },

    enumerable: true,
    configurable: false
  };

};

// # describe

var types = create(null);

function describe(SuperNode, description) {

  var type = description.type;

  // the eval here is to assign a dynamic name to the function
  // which also works with ./util/type-of
  var SubNode = new Function('SuperNode',
    'return function ' + type + '() {' +
      'SuperNode.apply(this, arguments);' +
    '};'
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
    if (key === 'type') continue;
    var field = description[key];

    if (typeOf(field) === 'Array') {
      descriptors[key] = listGetter(type, key, expect.apply(null, field));
    } else if (typeOf(field.test) === 'Function') {
      descriptors[key] = propertyAccessor(key, field);
    }
  }

  SubNode.keys = keys;

  SubNode.prototype = create(SuperNode.prototype, descriptors);

  return types[type] = SubNode;
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
}

BaseList.prototype = create(Array.prototype, {

  constructor: p(BaseList),

  removeChild: d(function(child) {
    var io = this.indexOf(child);
    if (io > -1) this.splice(io, 1);
    if (child) delete child.parentNode;
    return this;
  }),

  replaceChild: d(function(child, value) {
    var io = this.indexOf(child);
    if (io > -1) this.splice(io, 1, child);
    return this;
  }),

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
      found = visitor.call(this, node, i);
      if (found !== void 0) break;
      if (deep && node) {
        found = node.traverse(visitor, deep);
      }
      if (found !== void 0) break;
    }

    return found;
  }),

  forEachRight: d(function(visitor, ctx) {
    for (var i = this.length; i--;) {
      visitor.call(ctx, this[i], i, this);
    }
  }),

  slice: d(function() {
    var list = new BaseList;
    for (var i = 0; i < this.length; i++) list.push(this[i]);
    return list;
  }),

  root: rootMe

});

BaseList.test = function(item) {
  return item instanceof BaseList;
};

// # List

function setNodeParent(node, parent) {
  if (typeOf(node) === 'Object') node = build(node);

  var test = parent.constructor.accept;

  if (test && !test(node)) {
    throw new TypeError('invalid item: ' + (node && node.type) + ' on ' + parent.constructor.name);
  }

  if (node && node.parentNode) node.parentNode.removeChild(node);

  define(node, 'parentNode', d(parent));

  return node;
}

function unsetNodeParent(node) {
  if (node) delete node.parentNode;
  return node;
}

var UID = 0;

function List(parent) {
  define(this, 'parentNode', p(parent));
  define(this, 'uid', p((UID++).toString(36)));
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
    var nodes = [];
    for (var i = 0; i < arguments.length; i++) nodes.push(setNodeParent(arguments[i], this));
    return Array.prototype.push.apply(this, nodes);
  }),

  pop: d(function() {
    return unsetNodeParent(Array.prototype.pop.call(this));
  }),

  shift: d(function() {
    return unsetNodeParent(Array.prototype.shift.call(this));
  }),

  unshift: d(function() {
    var nodes = [];
    for (var i = 0; i < arguments.length; i++) nodes.push(setNodeParent(arguments[i], this));
    return Array.prototype.unshift.apply(this, nodes);
  })

});

List.test = function(item) {
  return item instanceof List;
};

// # Node

function Node(ast) {
  define(this, 'uid', p((UID++).toString(36)));

  if (!ast) return;

  var keys = this.constructor.keys;

  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (key === 'type') continue; // no need for type here

    var value = ast[key];
    if (value === void 0) continue;

    // don't process loc
    if ((/^(loc|range)$/).test(key)) {
      this[key] = value;
      continue;
    }

    switch(typeOf(value)) {
      case 'Object':
        this[key] = value;
        break;
      case 'Array':
        var list = this[key];
        list.push.apply(list, value);
        break;
      default: this[key] = value;
    }
  }
}

Node.prototype = create({}, {

  constructor: p(Node),

  removeChild: d(function(child) {
    var key = this.indexOf(child);
    if (key !== void 0) delete this['@' + key];
    if (child) delete child.parentNode;
    return this;
  }),

  toJSON: d(function() {
    var properties = {};
    if (this.loc) properties.loc = this.loc; // just add loc
    if (this.range) properties.range = this.range; // just add range

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

      found = visitor.call(this, value, key);
      if (found !== void 0) break;
      if (deep && (value instanceof Node || value instanceof List)) {
        found = value.traverse(visitor, deep);
      }
      if (found !== void 0) break;
    }

    return found;
  }),

  replaceChild: d(function(child, value) {
    var key = this.indexOf(child);
    if (key !== void 0) this[key] = value;
    return this;
  }),

  indexOf: d(function(value) {
    var keys = this.constructor.keys;
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (this[key] === value) return key;
    }
  }),

  root: rootMe

});

Node.test = function(item) {
  return item instanceof Node;
};

// # build

function build(ast) {
  if (ast == null) return null;

  if (ast instanceof Node || ast instanceof List) return ast; // already one of our objects.

  var type = ast.type;

  var NodeClass = types[type];
  // NodeClass not found
  if (!NodeClass) throw new Error('missing type: ' + type);

  return new NodeClass(ast);
}

exports.Node = Node;
exports.List = List;
exports.BaseList = BaseList;

types.Node = Node;
types.List = List;

exports.types = types;

exports.p = p;
exports.f = f;
exports.d = d;
exports.g = g;

exports.describe = describe;
exports.expect = expect;
exports.build = build;
