/* eslint-disable complexity */
import GL from '@luma.gl/constants';
import {Buffer} from '../webgl';
import {log, uid} from '../utils';
import {hasFeature, FEATURES} from '../webgl-context/context-features';

export default class Attribute {
  constructor(gl, props = {}) {
    const {id = uid('attribute'), type, isIndexed = false} = props;

    // Options that cannot be changed later
    this.gl = gl;
    this.id = id;

    this.isIndexed = isIndexed;
    this.target = isIndexed ? GL.ELEMENT_ARRAY_BUFFER : GL.ARRAY_BUFFER;

    // Initialize the attribute accessor
    this.accessor = {};
    this.accessor.type = type;
    if (isIndexed && !type) {
      // If the attribute is indices, auto infer the correct type
      // WebGL2 and WebGL1 w/ uint32 index extension support accepts Uint32Array, otherwise Uint16Array
      this.accessor.type =
        gl && hasFeature(gl, FEATURES.ELEMENT_INDEX_UINT32) ? GL.UNSIGNED_INT : GL.UNSIGNED_SHORT;
    }

    this.value = null;
    this.externalBuffer = null;
    this.buffer = null;
    this.userData = {}; // Reserved for application

    this.update(props);

    // Sanity - don't allow app fields. Use userData instead.
    Object.seal(this);
  }

  delete() {
    if (this.buffer) {
      this.buffer.delete();
      this.buffer = null;
    }
  }

  update(props) {
    // TODO - clean up this mess!
    const {constant = this.constant || false} = props;
    this.constant = constant;

    if (props.buffer) {
      this._setBuffer(props.buffer);
    } else if (props.value) {
      this._setValue(props.value, constant, props);
    }

    this._setAccessor(props);
  }

  getBuffer() {
    if (this.constant) {
      return null;
    }
    return this.externalBuffer || this.buffer;
  }

  getValue() {
    if (this.constant) {
      return this.value;
    }
    const buffer = this.externalBuffer || this.buffer;
    if (buffer) {
      return [buffer, this.accessor];
    }
    return null;
  }

  // PRIVATE HELPERS

  _setBuffer(buffer) {
    this.externalBuffer = buffer;
    this.constant = false;

    this.accessor.type = buffer.accessor.type;
    if (buffer.accessor.divisor !== undefined) {
      this.accessor.divisor = buffer.accessor.divisor;
    }
  }

  _setValue(value, constant, props) {
    this.externalBuffer = null;
    this.value = value;

    if (!constant && this.gl) {
      // Create buffer if needed
      if (!this.buffer) {
        this.buffer = new Buffer(
          this.gl,
          Object.assign({}, props, {
            id: this.id,
            target: this.target,
            type: this.accessor.type
          })
        );
      }
      this.buffer.setData({data: value});
      this.accessor.type = this.buffer.accessor.type;
    }
  }

  // Sets all accessor props except type
  _setAccessor(props) {
    const {
      // accessor props
      size = this.size,
      offset = this.offset || 0,
      stride = this.stride || 0,
      normalized = this.normalized || false,
      integer = this.integer || false,
      divisor = this.divisor || 0,
      instanced,
      isInstanced
    } = props;

    // TODO - Move to using accessors directly
    // if (props.accessor) {
    //   this.accessor = props.accessor;
    // }

    this.accessor.size = size;
    this.accessor.offset = offset;
    this.accessor.stride = stride;
    this.accessor.normalized = normalized;
    this.accessor.integer = integer;

    this.accessor.divisor = divisor;

    if (isInstanced !== undefined) {
      log.deprecated('Attribute.isInstanced', 'attribute.divisor')();
      this.accessor.divisor = isInstanced ? 1 : 0;
    }
    if (instanced !== undefined) {
      log.deprecated('Attribute.instanced', 'attribute.divisor')();
      this.accessor.divisor = instanced ? 1 : 0;
    }
  }

  // TEMPORARY - Keep deck.gl from breaking - remove as soon as tested
  get type() {
    log.deprecated('Attribute.type', 'Attribute.accessor')();
    return this.accessor.type;
  }

  set type(value) {
    log.deprecated('Attribute.type', 'Attribute.accessor')();
    this.accessor.type = value;
  }

  get size() {
    log.deprecated('Attribute.size', 'Attribute.accessor')();
    return this.accessor.size;
  }

  set size(value) {
    log.deprecated('Attribute.size', 'Attribute.accessor')();
    this.accessor.size = value;
  }

  get offset() {
    log.deprecated('Attribute.offset', 'Attribute.accessor')();
    return this.accessor.offset;
  }

  set offset(value) {
    log.deprecated('Attribute.offset', 'Attribute.accessor')();
    this.accessor.offset = value;
  }

  get stride() {
    log.deprecated('Attribute.stride', 'Attribute.accessor')();
    return this.accessor.stride;
  }

  set stride(value) {
    log.deprecated('Attribute.stride', 'Attribute.accessor')();
    this.accessor.stride = value;
  }

  get normalized() {
    log.deprecated('Attribute.normalized', 'Attribute.accessor')();
    return this.accessor.normalized;
  }

  set normalized(value) {
    log.deprecated('Attribute.normalized', 'Attribute.accessor')();
    this.accessor.normalized = value;
  }

  get integer() {
    log.deprecated('Attribute.integer', 'Attribute.accessor')();
    return this.accessor.integer;
  }

  set integer(value) {
    log.deprecated('Attribute.integer', 'Attribute.accessor')();
    this.accessor.integer = value;
  }

  get divisor() {
    log.deprecated('Attribute.divisor', 'Attribute.accessor')();
    return this.accessor.divisor;
  }

  set divisor(value) {
    log.deprecated('Attribute.divisor', 'Attribute.accessor')();
    this.accessor.divisor = value;
  }
}
