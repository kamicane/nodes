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

  lists[listName] = SubList;

  SubList.prototype = create(List.prototype, {
    constructor: p(SubList)
  });

  SubList.test = function(item) {
    return item instanceof SubList;
  };

  SubList.accepts = test && test.test;

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
var lists = create(null);

function describe(SuperNode, description) {

  var type = description.type;

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

  SubNode.keys = keys.concat('loc', 'range');

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
  define(this, 'length', d(0));
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
    if (io > -1) this.splice(io, 1, value);
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
    var found, skip = {};

    for (var i = 0; i < this.length; i++) {
      var node = this[i];
      found = visitor.call(this, node, i, skip);
      if (found === skip) continue;
      if (found !== void 0) break;
      if (deep && node) {
        found = node.traverse(visitor, deep);
        if (found !== void 0) break;
      }
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

  filter: d(function(method, ctx) {
    var list = new BaseList;
    for (var i = 0; i < this.length; i++) {
      var value = this[i];
      if (method.call(ctx, value, i, this)) list.push(value);
    }
    return list;
  }),

  root: rootMe

});

BaseList.test = function(item) {
  return item instanceof BaseList;
};

// # List

function setNodeList(list, index, node) {
  var constructor = list.constructor;
  var accepts = constructor.accepts;

  if (accepts && !accepts(node)) {
    throw new TypeError('invalid item: ' + (node && node.type) + ' on ' + constructor.name);
  }

  // arguments only accept Nodes and NULL
  if (node) {
    if (node.parentNode) node.parentNode.removeChild(node);
    define(node, 'parentNode', d(list));
  }

  return node;
}

function unsetNodeList(node) {
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
      node = setNodeList(this, i, arguments[i]);
      nodes.push(node);
    }

    for (var j = index; j < howMany; j++) unsetNodeList(this[j]);

    return Array.prototype.splice.apply(this, [index, howMany].concat(nodes));
  }),

  push: d(function() {
    var nodes = [];
    for (var i = 0; i < arguments.length; i++) nodes.push(setNodeList(this, i, arguments[i]));
    return Array.prototype.push.apply(this, nodes);
  }),

  pop: d(function() {
    return unsetNodeList(Array.prototype.pop.call(this));
  }),

  shift: d(function() {
    return unsetNodeList(Array.prototype.shift.call(this));
  }),

  unshift: d(function() {
    var nodes = [];
    for (var i = 0; i < arguments.length; i++) nodes.push(setNodeList(this, i, arguments[i]));
    return Array.prototype.unshift.apply(this, nodes);
  })

});

List.test = function(item) {
  return item instanceof List;
};

lists.List = List;

// # Node

function Node(description) {
  define(this, 'uid', p((UID++).toString(36)));

  if (!description) return;

  var keys = this.constructor.keys;

  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (key === 'type') continue;

    var value = description[key];
    if (value === void 0) continue;

    if (value instanceof Array) {
      var list = this[key];
      list.push.apply(list, value);
    } else {
      this[key] = value;
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
    var found, skip = {};

    var keys = this.constructor.keys;

    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (/^(loc|range)$/.test(key)) continue;

      var value = this[key];
      found = visitor.call(this, value, key, skip);
      if (found === skip) continue;
      if (found !== void 0) break;
      if (deep && (value instanceof Node || value instanceof List)) {
        found = value.traverse(visitor, deep);
        if (found !== void 0) break;
      }
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

  clone: d(function() {
    return build(this.toJSON());
  }),

  root: rootMe

});

Node.test = function(item) {
  return item instanceof Node;
};

// # build

function build(ast) {
  if (ast === null) return null;
  if (ast === void 0) return void 0;
  if (ast instanceof Node) return ast; // passthrough

  var type = ast.type;
  if (!type) return ast;

  var NodeClass = types[type];
  // NodeClass not found
  if (!NodeClass) throw new Error('missing type: ' + type);

  if (NodeClass.pre) ast = NodeClass.pre(ast);

  var keys = NodeClass.keys;
  var self = new NodeClass;

  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (key === 'type') continue;
    var value = ast[key];

    if (/^(loc|range)$/.test(key)) {
      self[key] = value;
      continue;
    }

    if (value === void 0) continue;

    switch (typeOf(value)) {
      case 'Array':
        var list = self[key];
        list.push.apply(list, value.map(build));
        break;
      case 'Object':
        self[key] = build(value);
        break;
      default:
        self[key] = value;
    }

  }

  return self;
}

exports.Node = Node;
exports.List = List;
exports.BaseList = BaseList;

types.Node = Node;

exports.types = types;
exports.lists = lists;

exports.p = p;
exports.f = f;
exports.d = d;
exports.g = g;

exports.describe = describe;
exports.expect = expect;
exports.build = build;
