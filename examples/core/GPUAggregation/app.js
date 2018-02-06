/* eslint-disable no-var, max-statements */

import {
  AnimationLoop, Buffer, GL, setParameters,
  Model, Framebuffer, Renderbuffer, Texture2D
} from 'luma.gl';
import assert from 'assert';
/* global console */
/* eslint-disable no-console */

const MARGIN = 2; // pixels

const VERTEX_SHADER_POINTS = `\
attribute vec2 positions;
uniform vec2 windowSize;
void main(void) {
  // Map each vertex from (0,0):windowSize -> (-1, -1):(1,1)
  vec2 pos = (positions * (2., 2.) / (windowSize)) - (1., 1.);
  gl_Position = vec4(pos, 1.0, 1.0);
}
`;


const GENERATE_GRIDTEX_VS = `\
attribute vec2 positions;
uniform vec2 windowSize;
uniform vec2 cellSize;
void main(void) {

  // -TODO- : some issue with this mapping
  //  we are rendering to FB of size texRect, is this mapping correct?

  // Map each vertex from (0,0):windowSize -> (0, 0): texRect
  vec2 pos = floor(positions / cellSize);
  vec2 texRect = floor(windowSize / cellSize); // TODO-1: this must be Integer division

  // Map each vertex from (0,0):texRect -> (-1, -1):(1,1)
  pos = (pos * (2., 2.) / (texRect)) - (1., 1.);
  gl_Position = vec4(pos, 1.0, 1.0);

  // //-hack remove this code
  // // Map each vertex from (0,0):windowSize -> (-1, -1):(1,1)
  // vec2 pos = (positions * (2., 2.) / (windowSize)) - (1., 1.);
  // gl_Position = vec4(pos, 1.0, 1.0);

  // // -hack- remove this code
  // // Map each vertex from (0,0):windowSize -> (0, 0): texRect
  // vec2 pos = floor(positions / cellSize);
  // vec2 texRect = floor(windowSize / cellSize); // TODO-1: this must be Integer division
  //
  // // Map each vertex from (0,0):texRect -> (-1, -1):(0,0) => this show grid of points
  // pos = (pos / (texRect)) - (1., 1.);
  // gl_Position = vec4(pos, 1.0, 1.0);

}
`;


const GENERATE_GRIDTEX_FS = `\
#ifdef GL_ES
precision highp float;
#endif

void main(void) {
  gl_FragColor = vec4(0.05, 0, 0, 1.0);
  // gl_FragColor = vec4(1.0, 0, 0, 1.0); //-hack
}
`;

const RENDER_POINTS_VS = `\
attribute vec2 positions;
uniform vec2 windowSize;
void main(void) {

  // Map each vertex from (0,0):windowSize -> (-1, -1):(1,1)
  vec2 pos = (positions * (2., 2.) / (windowSize)) - (1., 1.);

  // //-hack remove
  // pos = pos + vec2(0.2, 0);

  gl_Position = vec4(pos, 1.0, 1.0);
}
`;


const RENDER_POINTS_FS = `\
#ifdef GL_ES
precision highp float;
#endif

void main(void) {
  gl_FragColor = vec4(0.0, 1.0, 0, 1.0);
}
`;


const RENDER_GRIDTEX_VS = `\
attribute vec2 positions;
attribute vec2 offsets;
// attribute vec2 texCoords;
uniform vec2 windowSize;
varying vec2 vTextureCoord;
void main(void) {
  // Map each vertex from (0,0):windowSize -> (-1, -1):(1,1)
  vec2 pos = ((positions + offsets) * (2., 2.) / (windowSize)) - (1., 1.);
  gl_Position = vec4(pos, 1.0, 1.0);

  // Position is in (-1, -1) to (1, 1) => texCord (0, 0) -> (1, 1)
  vTextureCoord = (positions + offsets) / windowSize;
}
`;

const RENDER_GRIDTEX_FS = `\
#ifdef GL_ES
precision highp float;
#endif

varying vec2 vTextureCoord;
uniform sampler2D uSampler;

void main(void) {
  vec4 textureColor = texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t));
  // gl_FragColor = vec4(1.0, 0, 0, 1.0);
  // gl_FragColor = vec4(textureColor.rgb, 1.0);
  gl_FragColor = vec4(textureColor.r, 0.0, 0.0, 1.0);

  //-hack- remove => tex coords are fine , range form (0,0) -> (1, 1)
  // gl_FragColor = vec4(vTextureCoord, 0.0, 1.0);

}
`;

// RENDER each pixel in Grid as vertex, sample the value for gridTex
// Setup blending to sum values of RGB and Max value for A
const AGGREGATE_SUM_GRIDTEX_VS = `\
attribute vec2 positions;
attribute vec2 texCoords;
varying vec2 vTextureCoord;
void main(void) {
  // Position is in screen space
   gl_Position = vec4(-1.0, -1.0, 1.0, 1.0);
  //gl_Position = vec4(positions.rg, 1.0, 1.0); //-hack

  vTextureCoord = texCoords;
}
`;

const AGGREGATE_SUM_GRIDTEX_FS = `\
#ifdef GL_ES
precision highp float;
#endif

varying vec2 vTextureCoord;
uniform sampler2D uSampler;

void main(void) {
  vec4 textureColor = texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t));
  // gl_FragColor = vec4(1.0, 0, 0, 1.0);
  gl_FragColor = vec4(textureColor.rgb, textureColor.r);
}
`;

const SQUARE_TEX_VS = `\
attribute vec2 positions;
attribute vec2 texCoords;
varying vec2 vTextureCoord;
void main(void) {
  gl_Position = vec4(positions, 1.0, 1.0);
  vTextureCoord = vTextureCoord;
}
`;

const SQUARE_TEX_FS = `\
#ifdef GL_ES
precision highp float;
#endif

varying vec2 vTextureCoord;
uniform sampler2D uSampler;

void main(void) {
  vec4 textureColor = texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t));
  gl_FragColor = vec4(textureColor.rgb, 1.0);
}
`;

const SQUARE_WINDOW_SPACE_TEX_VS = `\
attribute vec2 positions;
uniform vec2 windowSize;
varying vec2 vTextureCoord;
void main(void) {

  // Map each vertex from (0,0):windowSize -> (-1, -1):(1,1)
  vec2 pos = (positions * (2., 2.) / (windowSize)) - (1., 1.);

  // //hack remove
  // pos = pos + vec2(0.2, 0);

  gl_Position = vec4(pos, 1.0, 1.0);

  vTextureCoord = vTextureCoord;
}
`;


let gridFramebuffer;
let girdAggregrationFramebuffer;

const animationLoop = new AnimationLoop({
  useDevicePixels: false,
  onInitialize({gl, canvas, aspect, width, height}) {

    console.log(`W: ${width} H: ${height}`);
    console.log(`canvas W: ${canvas.width} H: ${canvas.height}`);
    console.log(`gl.canvas W: ${gl.canvas.width} H: ${gl.canvas.height}`);

    setParameters(gl, {
      clearColor: [0, 0, 0, 1],
      clearDepth: [1],
      depthTest: true,
      depthFunc: gl.LEQUAL,

      blend: true,
      blendEquation: GL.FUNC_ADD,
      blendFunc: [GL.ONE, GL.ONE]
//      blendColor: [1.0, 1.0, 1.0, 1.0],
    });

    return buildModels({gl});
  },
  onRender(context) {
    const gl = context.gl;
    const {
      girdTexGenerateModel, boundingRectModel, girdTexRenderModel,
      gridSize, girdAggregationTexModel, pointsRenderModel,
      squareTextureModel, squareWindowSpaceTextureModel
    } = context;

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    generateGridTexture(gl, {
      gridSize,
      girdTexGenerateModel,
      renderToWindow: false
    });

    girdTexRenderModel.draw({
      uniforms: {
        uSampler: gridFramebuffer.texture
      },
      parameters: {
        blend: false
      }
    });
    // squareTextureModel.render({
    //   uSampler: gridFramebuffer.texture
    // });
    // squareWindowSpaceTextureModel.render({
    //   uSampler: gridFramebuffer.texture
    // });

    // generateGridAggregationTexture(gl, {
    //   gridSize,
    //   girdAggregationTexModel
    // });
    //
    // girdTexRenderModel.render({
    //   uSampler: girdAggregrationFramebuffer.texture
    // });

    pointsRenderModel.draw({
      parameters: {
        blend: false
      }
    });

    return false;
  }
});

function buildModels(opts) {
  const cellSize = [25, 25];
  const {gl} = opts;
  const canvas = gl.canvas;

  const windowSize = [canvas.width, canvas.height];
  const gridSize = [
    Math.floor(windowSize[0] / cellSize[0]),
    Math.floor(windowSize[1] / cellSize[1])
  ];

  console.log(`Window ${windowSize[0]}X${windowSize[1]}`);
  console.log(`Cell ${cellSize[0]}X${cellSize[1]}`);
  console.log(`Grid ${gridSize[0]}X${gridSize[1]}`);

  // const pointCount = 900;
  const pointsData = [
    {
      x: 0,
      y: 0,
      width: windowSize[0],
      height: windowSize[1],
      count: 10000
    },
    {
      x: 400,
      y: 100,
      width: 25,
      height: 25,
      count: 25
    },
    {
      x: 600,
      y: 0,
      width: 25,
      height: 25,
      count: 100
    }
  ];

  let points = [];
  for (const ptData of pointsData) {
    const pts = getRandomPoints(ptData);
    points = points.concat(pts);
  }
  const pointCount = points.length / 2;
  /*
  // Get random points in (0, 0 ) -> (canvas.width, canvas.height)
  let points = getRandomPoints({
    x: 0,
    y: 0,
    width: windowSize[0],
    height: windowSize[1],
    count: pointCount / 3
  });

  const points2 = getRandomPoints({
    x: 900,
    y: 500,
    width: 25,
    height: 25,
    count: pointCount / 3
  });

  const points3 = getRandomPoints({
    x: 0,
    y: 0,
    width: 25,
    height: 25,
    count: pointCount / 3
  });

  points = points.concat(points2);
  points = points.concat(points3);
  */

  const boundingRect = getBoundingRect(points, pointCount);
  // const canvasW = canvas.width;
  // const canvasH = canvas.height;

  const gridTexRectVertices = [1, 1,  -1, 1,  1, -1,  -1, -1];
  const gridTexRectWindowSpaceVertices = [
    gridSize[0], gridSize[1],
    0, gridSize[1],
    gridSize[0], 0,
    0, 0
  ];
  const gridTexCoords = new Float32Array([
    1.0, 1.0,
    0.0, 1.0,
    1.0, 0.0,
    0.0, 0.0
  ]);
  const gridVertices = generateVerticesForGrid(windowSize, cellSize);
  const gridOffsetsData = generateOffsetsForGrid(windowSize, cellSize);

  const gridTexPixels = getVertexPerEachPixel(gridSize);
  const gridTexTexCoords = getTexCoordPerEachPixel(gridSize);

  const pointPositions = new Buffer(gl, {size: 2, data: new Float32Array(points)});
  const boundingRectPositions = new Buffer(gl, {size: 2, data: new Float32Array(boundingRect)});
  const gridTexRectPositions = new Buffer(gl, {size: 2, data: new Float32Array(gridTexRectVertices)});
  const gridTexRectTexCoords = new Buffer(gl, {size: 2, data: new Float32Array(gridTexCoords)});

  const gridTexRectPixelPositions = new Buffer(gl, {size: 2, data: new Float32Array(gridTexPixels)});
  const gridTexRectPixelTexCoords = new Buffer(gl, {size: 2, data: new Float32Array(gridTexTexCoords)});

  //-TODO- use this to render grid
  const gridPositions = new Buffer(gl, {size: 2, data: new Float32Array(gridVertices)});
  const gridOffsets = new Buffer(gl, {size: 2, data: new Float32Array(gridOffsetsData), instanced: 1});

  const squarePositions = new Buffer(gl, {size: 2, data: new Float32Array(gridTexRectVertices)});
  const squareWindowSpacePositions = new Buffer(gl, {size: 2, data: new Float32Array(gridTexRectWindowSpaceVertices)});
  const squareTexCoords = new Buffer(gl, {size: 2, data: new Float32Array(gridTexCoords)});

  const girdTexGenerateModel = new Model(gl, {
    id: 'Gird-Tex-Generation',
    // vs: VERTEX_SHADER_POINTS,
    vs: GENERATE_GRIDTEX_VS,
    fs: GENERATE_GRIDTEX_FS,
    attributes: {
      positions: pointPositions
    },
    uniforms: {
      windowSize,
      cellSize
    },
    vertexCount: pointCount,
    drawMode: GL.POINTS
  });
  const boundingRectModel = new Model(gl, {
    id: 'BoundingRect-Model',
    vs: VERTEX_SHADER_POINTS,
    fs: GENERATE_GRIDTEX_FS,
    attributes: {
      positions: boundingRectPositions
    },
    uniforms: {
      windowSize
    },
    vertexCount: 2,
    drawMode: GL.LINES
  });

  const girdAggregationTexModel = new Model(gl, {
    id: 'GridAggregationTexture-Model',
    vs: AGGREGATE_SUM_GRIDTEX_VS,
    fs: AGGREGATE_SUM_GRIDTEX_FS,
    attributes: {
      positions: gridTexRectPixelPositions,
      texCoords: gridTexRectPixelTexCoords
    },
    vertexCount: gridTexPixels.length / 2,
    drawMode: GL.POINTS
  });

  const girdTexRenderModel = new Model(gl, {
    id: 'GridTexture-Render- Model',
    vs: RENDER_GRIDTEX_VS,
    fs: RENDER_GRIDTEX_FS,
    attributes: {
      positions: gridPositions,
//        texCoords: gridTexRectTexCoords,
      offsets: gridOffsets
    },
    uniforms: {
      windowSize
    },
    isInstanced: 1,
    instanceCount: gridOffsetsData.length / 2,
    vertexCount: 4, //gridVertices.length / 2,
    drawMode: GL.TRIANGLE_STRIP // GL.LINE_STRIP // TRIANGLE_STRIP
  });

  const pointsRenderModel = new Model(gl, {
    id: 'Points-Render-Model',
    // vs: VERTEX_SHADER_POINTS,
    vs: RENDER_POINTS_VS,
    fs: RENDER_POINTS_FS,
    attributes: {
      positions: pointPositions
    },
    uniforms: {
      windowSize
    },
    vertexCount: pointCount,
    drawMode: GL.POINTS
  });

  const squareTextureModel = new Model(gl, {
    id: 'Square-Tex-Model',
    vs: SQUARE_TEX_VS,
    fs: SQUARE_TEX_FS,
    attributes: {
      positions: squarePositions,
      texCoords: squareTexCoords
    },
    vertexCount: 4,
    drawMode: GL.TRIANGLE_STRIP
  });

  const squareWindowSpaceTextureModel = new Model(gl, {
    id: 'Square-Tex-Model',
    vs: SQUARE_WINDOW_SPACE_TEX_VS,
    fs: SQUARE_TEX_FS, // RENDER_POINTS_FS,
    attributes: {
      positions: squareWindowSpacePositions,
      texCoords: squareTexCoords
    },
    uniforms: {
      windowSize
    },
    vertexCount: 4,
    drawMode: GL.TRIANGLE_STRIP
  });

  girdAggregrationFramebuffer = setupFramebuffer(gl, {gridSize, id: 'GridAggregation'});
  gridFramebuffer = setupFramebuffer(gl, {gridSize, id: 'Grid'});

  return {
    girdTexGenerateModel,
    boundingRectModel,
    girdTexRenderModel,
    girdAggregationTexModel,
    pointsRenderModel,
    squareTextureModel,
    squareWindowSpaceTextureModel,
    cellSize,
    gridSize
  };
}

function generateGridAggregationTexture(gl, opts) {
  const {gridSize, girdAggregationTexModel} = opts;

  girdAggregationTexModel.draw({
    framebuffer: girdAggregrationFramebuffer,
    parameters: {
      clearColor: [0, 0, 0, 0],
      clearDepth: 0,
      blendEquation: [GL.FUNC_ADD, GL.MAX],
      viewport: [0, 0, 1, 1]
    },
    uniforms: {
      uSampler: gridFramebuffer.texture
    }
  });

}

function generateGridTexture(gl, opts) {
  const {gridSize, girdTexGenerateModel, renderToWindow} = opts;

  //-TODO- : verif this
  gridFramebuffer.bind();

  gl.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT);

  girdTexGenerateModel.draw({
    // framebuffer: renderToWindow ? null : gridFramebuffer,
    parameters: {
      clearColor: [0, 0, 0, 0],
      clearDepth: 0,
      viewport: [0, 0, gridSize[0], gridSize[1]], // -hack- enable this line
      blend: true,
      blendEquation: GL.FUNC_ADD,
      blendFunc: [GL.ONE, GL.ONE]
    }
  });

  gridFramebuffer.unbind();

}

function setupFramebuffer(gl, opts) {
  const {gridSize, id} = opts;
  const rttTexture = new Texture2D(gl, {
    data: null,
    format: GL.RGBA,
    type: GL.UNSIGNED_BYTE,
    border: 0,
    mipmaps: false,
    parameters: {
      [GL.TEXTURE_MAG_FILTER]: GL.NEAREST, // GL.LINEAR,
      [GL.TEXTURE_MIN_FILTER]: GL.NEAREST // GL.LINEAR_MIPMAP_NEAREST
    },
    width: gridSize[0],
    height: gridSize[1],
    dataFormat: GL.RGBA
  });

  const renderbuffer = new Renderbuffer(gl, {
    format: GL.DEPTH_COMPONENT16,
    width: gridSize[0],
    height: gridSize[1]
  });

  const rttFramebuffer = new Framebuffer(gl, {
    id,
    width: gridSize[0],
    height: gridSize[1],
    attachments: {
      [GL.COLOR_ATTACHMENT0]: rttTexture,
      [GL.DEPTH_ATTACHMENT]: renderbuffer
    }
  });

  return rttFramebuffer;
}

// Generates (x, y) screen coordinates for each point in the rect
// x, y are in [-1, 1] range
function getVertexPerEachPixel(rectSize) {
  assert(Number.isFinite(rectSize[0]) && Number.isFinite(rectSize[1]));
  const points = [];
  for (let i = 0; i < rectSize[0]; i++) {
    for (let j = 0; j < rectSize[1]; j++) {
      const x = i * (2.0 / rectSize[0]) - 1.0;
      const y = j * (2.0 / rectSize[1]) - 1.0;
      points.push(x);
      points.push(y);
    }
  }
  return points;
}

// Generates (s, t) tex coordinates for each point in the rect
// s, t are in [0, 1] range
function getTexCoordPerEachPixel(rectSize) {
  assert(Number.isFinite(rectSize[0]) && Number.isFinite(rectSize[1]));
  const points = [];
  for (let i = 0; i < rectSize[0]; i++) {
    for (let j = 0; j < rectSize[1]; j++) {
      const s = i / rectSize[0];
      const t = j / rectSize[1];
      points.push(s);
      points.push(t);
    }
  }
  return points;
}

function generateTriangleVerticesInRect(start, end) {
  const startX = start[0] + MARGIN;
  const startY = start[1] + MARGIN;
  const endX = end[0] - MARGIN;
  const endY = end[1] - MARGIN;

  // [1, 1,  -1, 1,  1, -1,  -1, -1];
  // [1, 1,  -1, 1,  1, -1,  -1, -1]
  return [endX, endY,  startX, endY,  endX, startY, startX, startY];
}

function generateVerticesForGrid(windowSize, cellSize) {

  // let points = [];
  // let xOffset = 0;
  // let yOffset = 0;
  // for (let x = 0; x < windowSize[0]; x = x + cellSize[0]) {
  //   for (let y = 0; y < windowSize[1]; y = y + cellSize[1]) {
  //     const newPoints = generateTriangleVerticesInRect([x, y], [x + cellSize[0], y + cellSize[1]]);
  //     points = points.concat(newPoints);
  //   }
  // }
  // return points;
  return generateTriangleVerticesInRect([0, 0], cellSize);
}

function generateOffsetsForGrid(windowSize, cellSize) {

  const offsets = [];
  for (let x = 0; x < windowSize[0]; x = x + cellSize[0]) {
    for (let y = 0; y < windowSize[1]; y = y + cellSize[1]) {
      // const newPoints = generateTriangleVerticesInRect([x, y], [x + cellSize[0], y + cellSize[1]]);
      offsets.push(x, y);
    }
  }
  return offsets;
}

animationLoop.getInfo = () => {
  return `
  <p>
    <a href="http://learningwebgl.com/blog/?p=28" target="_blank">
      A Triangle and a Square
    </a>
  <p>
    The classic WebGL Lessons in luma.gl
    `;
};

// cell start :origin (x, y)
// cell size : rect (width, height)
// number of points: count
// Result count number of points in an array , each point (x, y)
// such that  origin.x <= x < orgin.x + width
function getRandomPoints(opts) {
  if (opts.count === 0) {
    return [];
  }
  assert(
    Number.isFinite(opts.x) &&
    Number.isFinite(opts.y) &&
    Number.isFinite(opts.width) &&
    Number.isFinite(opts.height) &&
    Number.isFinite(opts.count)
  );
  const points = new Array(opts.count * 2);
  for (let i = 0; i < opts.count; i++) {
    points[i * 2] = Math.floor(Math.random() * opts.width) + opts.x;
    points[(i * 2) + 1] = Math.floor(Math.random() * opts.height) + opts.y;
  }
  return points;
}

function getBoundingRect(points, count) {
  const rect = [points[0], points[1], points[0], points[1]];
  for (let i = 1; i < count; i++) {
    const x = points[i * 2];
    const y = points[(i * 2) + 1];
    if (x < rect[0]) {
      rect[0] = x;
    }
    if (y < rect[1]) {
      rect[1] = y;
    }
    if (x > rect[2]) {
      rect[2] = x;
    }
    if (y > rect[3]) {
      rect[3] = y;
    }
  }
  return rect;
}

export default animationLoop;

// expose on Window for standalone example
window.animationLoop = animationLoop; // eslint-disable-lie