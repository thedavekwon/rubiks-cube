// Do Hyung Kwon

// webGL objects
let canvas;
let gl;
let program;
let rubiksCube;

let vColor;
let vPosition;
let projectionMatrix = mat4();
let modelViewMatrix = mat4();

// drawArray indices for each mini-cube
const cubeIndices = [];
const stickerIndices = [];
const stickerMargin = 0.006;

// dictionary for face picker
const FACE = {};
FACE[255] = {};
FACE[0] = {};
FACE[255][255] = {};
FACE[255][0] = {};
FACE[0][255] = {};
FACE[0][0] = {};
FACE[255][0][0] = 1;
FACE[0][255][0] = 6;
FACE[0][0][255] = 3;
FACE[255][255][0] = 2;
FACE[0][255][255] = 5;
FACE[255][0][255] = 4;

// perspective view and camera
let eye = null;
let angle = 0.0;
let axis = 0;
let radius = 2.5;
let at = vec3(0.0, 0.0, 0.0);
let up = vec3(0.0, 1.0, 0.0);
let FOV = 45.0;
let aspect = 1.0;
let near = 1;
let far = 10000;
let theta = radians(45);
let phi = radians(45);

// for cube face rotation
let rotateTheta = 3;
let currentTheta = 0;
let isFaceRotating = false;
const timer = 1;
let interval = null;
let saveText;
const MOVES = ["L", "l", "R", "r", "U", "u", "D", "d", "F", "f", "B", "b", "M", "m", "E", "e", "S", "s"];

// variables for html interaction with events
let mouseLeftDown = false;
let mouseRightDown = false;
let cubeRotating = false;
let init_x;
let init_y;
let new_x;
let new_y;
let CANVAS_X_OFFSET;
let CANVAS_Y_OFFSET;

window.onload = function init() {
    // webgl initialization
    canvas = document.getElementById("gl-canvas");
    gl = WebGLUtils.setupWebGL(canvas, {preserveDrawingBuffer: true, premultipliedAlpha: false});

    CANVAS_X_OFFSET = canvas.offsetLeft;
    CANVAS_Y_OFFSET = canvas.offsetTop;

    if (!gl) {
        alert("WebGL isn't available");
    }

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.1, 0.1, 0.1, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);

    program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);

    rubiksCube = new RubiksCube();

    vPosition = gl.getAttribLocation(program, "vPosition");
    gl.enableVertexAttribArray(vPosition);

    vColor = gl.getAttribLocation(program, "vColor");
    gl.enableVertexAttribArray(vColor);

    // element initialization
    canvas.addEventListener("mousedown", startRotate);
    canvas.addEventListener("mouseup", stopRotate);
    canvas.addEventListener("mousemove", rotating);
    canvas.addEventListener("oncontextmenu", (event) => {
        event.preventDefault();
    });

    document.getElementById("LButton").onclick = () => {
        rubiksCube.pushTurn("L");
    };
    document.getElementById("RButton").onclick = () => {
        rubiksCube.pushTurn("R");
    };
    document.getElementById("UButton").onclick = () => {
        rubiksCube.pushTurn("U");
    };
    document.getElementById("DButton").onclick = () => {
        rubiksCube.pushTurn("D");
    };
    document.getElementById("FButton").onclick = () => {
        rubiksCube.pushTurn("F");
    };
    document.getElementById("BButton").onclick = () => {
        rubiksCube.pushTurn("B");
    };
    document.getElementById("MButton").onclick = () => {
        rubiksCube.pushTurn("M");
    };
    document.getElementById("EButton").onclick = () => {
        rubiksCube.pushTurn("E");
    };
    document.getElementById("SButton").onclick = () => {
        rubiksCube.pushTurn("S");
    };
    document.getElementById("LrButton").onclick = () => {
        rubiksCube.pushTurn("l");
    };
    document.getElementById("RrButton").onclick = () => {
        rubiksCube.pushTurn("r");
    };
    document.getElementById("UrButton").onclick = () => {
        rubiksCube.pushTurn("u");
    };
    document.getElementById("DrButton").onclick = () => {
        rubiksCube.pushTurn("d");
    };
    document.getElementById("FrButton").onclick = () => {
        rubiksCube.pushTurn("f");
    };
    document.getElementById("BrButton").onclick = () => {
        rubiksCube.pushTurn("b");
    };
    document.getElementById("MrButton").onclick = () => {
        rubiksCube.pushTurn("m");
    };
    document.getElementById("ErButton").onclick = () => {
        rubiksCube.pushTurn("e");
    };
    document.getElementById("SrButton").onclick = () => {
        rubiksCube.pushTurn("s");
    };

    saveText = document.getElementById("saveText");
    document.getElementById("saveButton").onclick = () => {
        rubiksCube.save();
    };

    document.getElementById("loadButton").onclick = () => {
        load();
    };

    document.getElementById("shuffle").onclick = () => {
        const shuffleNum = document.getElementById("shuffleNum").value;
        rubiksCube.shuffle(shuffleNum);
    };

    document.getElementById("reset").onclick = () => {
        reset();
    };

    render();
};


function render() {
    // if queue is not empty, pop from the queue and rotate the according face
    if (rubiksCube.queue.length !== 0 && !isFaceRotating) {
        rubiksCube.animate(rubiksCube.queue.shift());
        isFaceRotating = true;
    }
    requestAnimFrame(render);
    rubiksCube.draw(0);
}

// rubiksCube is collection of mini-cubes
class RubiksCube {
    constructor() {
        // for rubik's cube
        this.cubeVerticesBuffer = null;
        this.cubeColorsBuffer = null;
        // for mini-cube selector
        this.cubeSelectBuffer = null;
        // for face selector
        this.cubeFaceBuffer = null;
        this.cubeFaceVerticesBuffer = null;
        // for rubik's cube
        this.stickerVerticesBuffer = null;
        this.stickerColorsBuffer = null;

        this.cubeVertices = [];
        this.cubeColors = [];
        this.cubeSelects = [];
        this.cubeFaces = [];
        this.cubeFaceVertices = [];
        this.stickerVertices = [];
        this.stickerColors = [];

        // array of mini-cubes
        this.cubes = new Array(3);
        this.starts = {x: -0.15, y: -0.15, z: -0.15};
        this.ends = {x: 0.15, y: 0.15, z: 0.15};
        this.cubeSize = 0.30;
        this.rotatingCubes = [];
        this.queue = [];
        this.storage = [];

        // for mini-cube selector
        this.selectedCube1 = null;
        this.selectedCube2 = null;
        this.selectedFace1 = null;
        this.selectedFace2 = null;

        // initiate
        this.initCubes();
        this.buildFaceCube();
        this.initCubeBuffers();
        this.initStickerBuffers();

        // store last indices
        cubeIndices.push(this.cubeVertices.length);
        stickerIndices.push(this.stickerVertices.length);
    }

    // initialize mini-cubes
    initCubes() {
        for (let i = 0; i < 3; i++) {
            this.cubes[i] = new Array(3);
            for (let j = 0; j < 3; j++) {
                this.cubes[i][j] = new Array(3);
                for (let k = 0; k < 3; k++) {
                    const coordinate = [i - 1, j - 1, k - 1];
                    this.cubes[i][j][k] = new Cube(this, coordinate);
                }
            }
        }
    }

    // initialize buffers
    initCubeBuffers() {
        this.cubeVerticesBuffer = gl.createBuffer();
        this.cubeColorsBuffer = gl.createBuffer();
        this.cubeSelectBuffer = gl.createBuffer();
        this.cubeFaceBuffer = gl.createBuffer();
        this.cubeFaceVerticesBuffer = gl.createBuffer();

        gl.bindBuffer(gl.ARRAY_BUFFER, this.cubeVerticesBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(this.cubeVertices), gl.STATIC_DRAW);
        gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.cubeColorsBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(this.cubeColors), gl.STATIC_DRAW);
        gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.cubeSelectBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(this.cubeSelects), gl.STATIC_DRAW);
        gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.cubeFaceBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(this.cubeFaces), gl.STATIC_DRAW);
        gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.cubeFaceVerticesBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(this.cubeFaceVertices), gl.STATIC_DRAW);
        gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);
    }

    // initialize stickers
    initStickerBuffers() {
        this.stickerVerticesBuffer = gl.createBuffer();
        this.stickerColorsBuffer = gl.createBuffer();

        gl.bindBuffer(gl.ARRAY_BUFFER, this.stickerVerticesBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(this.stickerVertices), gl.STATIC_DRAW);
        gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.stickerColorsBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(this.stickerColors), gl.STATIC_DRAW);
        gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);
    }

    // turn the cube with according face with clicking two cubes in the same face
    rotate() {
        // left
        // console.log(this.selectedCube1.coordinates);
        // console.log(this.selectedCube2.coordinates);
        // console.log(this.selectedFace1);
        // console.log(this.selectedFace2);
        this.selectedCube1.coordinates.map(x => Math.round(x));
        this.selectedCube2.coordinates.map(x => Math.round(x));

        // white && orange
        if ((arraysEqual(this.selectedCube1.coordinates, [1, 1, 1]) || arraysEqual(this.selectedCube1.coordinates, [1, 0, 1])) &&
            (arraysEqual(this.selectedCube2.coordinates, [1, 0, 1]) || arraysEqual(this.selectedCube2.coordinates, [1, -1, 1]))) {
            if (this.selectedFace1 === this.selectedFace2) {
                if (this.selectedFace1 === 2) rubiksCube.pushTurn("F");
                if (this.selectedFace1 === 1) rubiksCube.pushTurn("r");
            }
        }
        if ((arraysEqual(this.selectedCube1.coordinates, [1, 0, 1]) || arraysEqual(this.selectedCube1.coordinates, [1, -1, 1])) &&
            (arraysEqual(this.selectedCube2.coordinates, [1, 1, 1]) || arraysEqual(this.selectedCube2.coordinates, [1, 0, 1]))) {
            if (this.selectedFace1 === this.selectedFace2) {
                if (this.selectedFace1 === 2) rubiksCube.pushTurn("f");
                if (this.selectedFace1 === 1) rubiksCube.pushTurn("R");
            }
        }

        // red && white
        if ((arraysEqual(this.selectedCube1.coordinates, [-1, 1, 1]) || arraysEqual(this.selectedCube1.coordinates, [-1, 0, 1])) &&
            (arraysEqual(this.selectedCube2.coordinates, [-1, 0, 1]) || arraysEqual(this.selectedCube2.coordinates, [-1, -1, 1]))) {
            if (this.selectedFace1 === this.selectedFace2) {
                if (this.selectedFace1 === 1) rubiksCube.pushTurn("L");
                if (this.selectedFace1 === 4) rubiksCube.pushTurn("f");
            }
        }
        if ((arraysEqual(this.selectedCube1.coordinates, [-1, -1, 1]) || arraysEqual(this.selectedCube1.coordinates, [-1, 0, 1])) &&
            (arraysEqual(this.selectedCube2.coordinates, [-1, 0, 1]) || arraysEqual(this.selectedCube2.coordinates, [-1, 1, 1]))) {
            if (this.selectedFace1 === this.selectedFace2) {
                if (this.selectedFace1 === 1) rubiksCube.pushTurn("l");
                if (this.selectedFace1 === 4) rubiksCube.pushTurn("F");
            }
        }

        // yellow && orange
        if ((arraysEqual(this.selectedCube1.coordinates, [1, 1, -1]) || arraysEqual(this.selectedCube1.coordinates, [1, 0, -1])) &&
            (arraysEqual(this.selectedCube2.coordinates, [1, 0, -1]) || arraysEqual(this.selectedCube2.coordinates, [1, -1, -1]))) {
            if (this.selectedFace1 === this.selectedFace2) {
                if (this.selectedFace1 === 3) rubiksCube.pushTurn("R");
                if (this.selectedFace1 === 2) rubiksCube.pushTurn("b");
            }
        }
        if ((arraysEqual(this.selectedCube1.coordinates, [1, -1, -1]) || arraysEqual(this.selectedCube1.coordinates, [1, 0, -1])) &&
            (arraysEqual(this.selectedCube2.coordinates, [1, 0, -1]) || arraysEqual(this.selectedCube2.coordinates, [1, 1, -1]))) {
            if (this.selectedFace1 === this.selectedFace2) {
                if (this.selectedFace1 === 3) rubiksCube.pushTurn("r");
                if (this.selectedFace1 === 2) rubiksCube.pushTurn("B");
            }
        }

        // red && yello
        if ((arraysEqual(this.selectedCube1.coordinates, [-1, 1, -1]) || arraysEqual(this.selectedCube1.coordinates, [-1, 0, -1])) &&
            (arraysEqual(this.selectedCube2.coordinates, [-1, 0, -1]) || arraysEqual(this.selectedCube2.coordinates, [-1, -1, -1]))) {
            if (this.selectedFace1 === this.selectedFace2) {
                if (this.selectedFace1 === 4) rubiksCube.pushTurn("B");
                if (this.selectedFace1 === 3) rubiksCube.pushTurn("l");
            }
        }
        if ((arraysEqual(this.selectedCube1.coordinates, [-1, -1, -1]) || arraysEqual(this.selectedCube1.coordinates, [-1, 0, -1])) &&
            (arraysEqual(this.selectedCube2.coordinates, [-1, 0, -1]) || arraysEqual(this.selectedCube2.coordinates, [-1, 1, -1]))) {
            if (this.selectedFace1 === this.selectedFace2) {
                if (this.selectedFace1 === 4) rubiksCube.pushTurn("b");
                if (this.selectedFace1 === 3) rubiksCube.pushTurn("L");
            }
        }

        //green && orange
        if ((arraysEqual(this.selectedCube1.coordinates, [1, 1, -1]) || arraysEqual(this.selectedCube1.coordinates, [1, 1, 0])) &&
            (arraysEqual(this.selectedCube2.coordinates, [1, 1, 0]) || arraysEqual(this.selectedCube2.coordinates, [1, 1, 1]))) {
            if (this.selectedFace1 === this.selectedFace2) {
                if (this.selectedFace1 === 5) rubiksCube.pushTurn("r");
                if (this.selectedFace1 === 2) rubiksCube.pushTurn("U");
            }
        }
        if ((arraysEqual(this.selectedCube1.coordinates, [1, 1, 1]) || arraysEqual(this.selectedCube1.coordinates, [1, 1, 0])) &&
            (arraysEqual(this.selectedCube2.coordinates, [1, 1, 0]) || arraysEqual(this.selectedCube2.coordinates, [1, 1, -1]))) {
            if (this.selectedFace1 === this.selectedFace2) {
                if (this.selectedFace1 === 5) rubiksCube.pushTurn("R");
                if (this.selectedFace1 === 2) rubiksCube.pushTurn("u");
            }
        }

        //red && green
        if ((arraysEqual(this.selectedCube1.coordinates, [-1, 1, -1]) || arraysEqual(this.selectedCube1.coordinates, [-1, 1, 0])) &&
            (arraysEqual(this.selectedCube2.coordinates, [-1, 1, 0]) || arraysEqual(this.selectedCube2.coordinates, [-1, 1, 1]))) {
            if (this.selectedFace1 === this.selectedFace2) {
                if (this.selectedFace1 === 5) rubiksCube.pushTurn("L");
                if (this.selectedFace1 === 4) rubiksCube.pushTurn("u");
            }
        }
        if ((arraysEqual(this.selectedCube1.coordinates, [-1, 1, 1]) || arraysEqual(this.selectedCube1.coordinates, [-1, 1, 0])) &&
            (arraysEqual(this.selectedCube2.coordinates, [-1, 1, 0]) || arraysEqual(this.selectedCube2.coordinates, [-1, 1, -1]))) {
            if (this.selectedFace1 === this.selectedFace2) {
                if (this.selectedFace1 === 5) rubiksCube.pushTurn("l");
                if (this.selectedFace1 === 4) rubiksCube.pushTurn("U");
            }
        }

        //red && blue
        if ((arraysEqual(this.selectedCube1.coordinates, [-1, -1, -1]) || arraysEqual(this.selectedCube1.coordinates, [-1, -1, 0])) &&
            (arraysEqual(this.selectedCube2.coordinates, [-1, -1, 0]) || arraysEqual(this.selectedCube2.coordinates, [-1, -1, 1]))) {
            if (this.selectedFace1 === this.selectedFace2) {
                if (this.selectedFace1 === 4) rubiksCube.pushTurn("D");
                if (this.selectedFace1 === 6) rubiksCube.pushTurn("l");
            }
        }
        if ((arraysEqual(this.selectedCube1.coordinates, [-1, -1, 1]) || arraysEqual(this.selectedCube1.coordinates, [-1, -1, 0])) &&
            (arraysEqual(this.selectedCube2.coordinates, [-1, -1, 0]) || arraysEqual(this.selectedCube2.coordinates, [-1, -1, -1]))) {
            if (this.selectedFace1 === this.selectedFace2) {
                if (this.selectedFace1 === 4) rubiksCube.pushTurn("d");
                if (this.selectedFace1 === 6) rubiksCube.pushTurn("L");
            }
        }

        //orange && blue
        if ((arraysEqual(this.selectedCube1.coordinates, [1, -1, 1]) || arraysEqual(this.selectedCube1.coordinates, [1, -1, 0])) &&
            (arraysEqual(this.selectedCube2.coordinates, [1, -1, 0]) || arraysEqual(this.selectedCube2.coordinates, [1, -1, -1]))) {
            if (this.selectedFace1 === this.selectedFace2) {
                if (this.selectedFace1 === 2) rubiksCube.pushTurn("D");
                if (this.selectedFace1 === 6) rubiksCube.pushTurn("r");
            }
        }
        if ((arraysEqual(this.selectedCube1.coordinates, [1, -1, -1]) || arraysEqual(this.selectedCube1.coordinates, [1, -1, 0])) &&
            (arraysEqual(this.selectedCube2.coordinates, [1, -1, 0]) || arraysEqual(this.selectedCube2.coordinates, [1, -1, 1]))) {
            if (this.selectedFace1 === this.selectedFace2) {
                if (this.selectedFace1 === 2) rubiksCube.pushTurn("d");
                if (this.selectedFace1 === 6) rubiksCube.pushTurn("R");
            }
        }

        // white && green
        if ((arraysEqual(this.selectedCube1.coordinates, [1, 1, 1]) || arraysEqual(this.selectedCube1.coordinates, [0, 1, 1])) &&
            (arraysEqual(this.selectedCube2.coordinates, [0, 1, 1]) || arraysEqual(this.selectedCube2.coordinates, [-1, 1, 1]))) {
            if (this.selectedFace1 === this.selectedFace2) {
                if (this.selectedFace1 === 1) rubiksCube.pushTurn("U");
                if (this.selectedFace1 === 5) rubiksCube.pushTurn("f");
            }
        }
        if ((arraysEqual(this.selectedCube1.coordinates, [-1, 1, 1]) || arraysEqual(this.selectedCube1.coordinates, [0, 1, 1])) &&
            (arraysEqual(this.selectedCube2.coordinates, [0, 1, 1]) || arraysEqual(this.selectedCube2.coordinates, [1, 1, 1]))) {
            if (this.selectedFace1 === this.selectedFace2) {
                if (this.selectedFace1 === 1) rubiksCube.pushTurn("u");
                if (this.selectedFace1 === 5) rubiksCube.pushTurn("F");
            }
        }

        // yellow && green
        if ((arraysEqual(this.selectedCube1.coordinates, [-1, 1, -1]) || arraysEqual(this.selectedCube1.coordinates, [0, 1, -1])) &&
            (arraysEqual(this.selectedCube2.coordinates, [0, 1, -1]) || arraysEqual(this.selectedCube2.coordinates, [1, 1, -1]))) {
            if (this.selectedFace1 === this.selectedFace2) {
                if (this.selectedFace1 === 3) rubiksCube.pushTurn("U");
                if (this.selectedFace1 === 5) rubiksCube.pushTurn("b");
            }
        }
        if ((arraysEqual(this.selectedCube1.coordinates, [1, 1, -1]) || arraysEqual(this.selectedCube1.coordinates, [0, 1, -1])) &&
            (arraysEqual(this.selectedCube2.coordinates, [0, 1, -1]) || arraysEqual(this.selectedCube2.coordinates, [-1, 1, -1]))) {
            if (this.selectedFace1 === this.selectedFace2) {
                if (this.selectedFace1 === 3) rubiksCube.pushTurn("u");
                if (this.selectedFace1 === 5) rubiksCube.pushTurn("B");
            }
        }

        // yellow && blue
        if ((arraysEqual(this.selectedCube1.coordinates, [-1, -1, -1]) || arraysEqual(this.selectedCube1.coordinates, [0, -1, -1])) &&
            (arraysEqual(this.selectedCube2.coordinates, [0, -1, -1]) || arraysEqual(this.selectedCube2.coordinates, [1, -1, -1]))) {
            if (this.selectedFace1 === this.selectedFace2) {
                if (this.selectedFace1 === 3) rubiksCube.pushTurn("d");
                if (this.selectedFace1 === 6) rubiksCube.pushTurn("B");
            }
        }
        if ((arraysEqual(this.selectedCube1.coordinates, [1, -1, -1]) || arraysEqual(this.selectedCube1.coordinates, [0, -1, -1])) &&
            (arraysEqual(this.selectedCube2.coordinates, [0, -1, -1]) || arraysEqual(this.selectedCube2.coordinates, [-1, -1, -1]))) {
            if (this.selectedFace1 === this.selectedFace2) {
                if (this.selectedFace1 === 3) rubiksCube.pushTurn("D");
                if (this.selectedFace1 === 6) rubiksCube.pushTurn("b");
            }
        }

        // white && blue
        if ((arraysEqual(this.selectedCube1.coordinates, [-1, -1, 1]) || arraysEqual(this.selectedCube1.coordinates, [0, -1, 1])) &&
            (arraysEqual(this.selectedCube2.coordinates, [0, -1, 1]) || arraysEqual(this.selectedCube2.coordinates, [1, -1, 1]))) {
            if (this.selectedFace1 === this.selectedFace2) {
                if (this.selectedFace1 === 1) rubiksCube.pushTurn("D");
                if (this.selectedFace1 === 6) rubiksCube.pushTurn("f");
            }
        }
        if ((arraysEqual(this.selectedCube1.coordinates, [1, -1, 1]) || arraysEqual(this.selectedCube1.coordinates, [0, -1, 1])) &&
            (arraysEqual(this.selectedCube2.coordinates, [0, -1, 1]) || arraysEqual(this.selectedCube2.coordinates, [-1, -1, 1]))) {
            if (this.selectedFace1 === this.selectedFace2) {
                if (this.selectedFace1 === 1) rubiksCube.pushTurn("d");
                if (this.selectedFace1 === 6) rubiksCube.pushTurn("F");
            }
        }

        // middle
        // green
        if ((arraysEqual(this.selectedCube1.coordinates, [0, 1, -1]) || arraysEqual(this.selectedCube1.coordinates, [0, 1, 0])) &&
            (arraysEqual(this.selectedCube2.coordinates, [0, 1, 0]) || arraysEqual(this.selectedCube2.coordinates, [0, 1, 1]))) {
            if (this.selectedFace1 === this.selectedFace2) {
                if (this.selectedFace1 === 5) rubiksCube.pushTurn("M");
            }
        }
        if ((arraysEqual(this.selectedCube1.coordinates, [0, 1, 1]) || arraysEqual(this.selectedCube1.coordinates, [0, 1, 0])) &&
            (arraysEqual(this.selectedCube2.coordinates, [0, 1, 0]) || arraysEqual(this.selectedCube2.coordinates, [0, 1, -1]))) {
            if (this.selectedFace1 === this.selectedFace2) {
                if (this.selectedFace1 === 5) rubiksCube.pushTurn("m");
            }
        }

        // white
        if ((arraysEqual(this.selectedCube1.coordinates, [0, 1, 1]) || arraysEqual(this.selectedCube1.coordinates, [0, 0, 1])) &&
            (arraysEqual(this.selectedCube2.coordinates, [0, 0, 1]) || arraysEqual(this.selectedCube2.coordinates, [0, -1, 1]))) {
            if (this.selectedFace1 === this.selectedFace2) {
                if (this.selectedFace1 === 1) rubiksCube.pushTurn("M");
            }
        }
        if ((arraysEqual(this.selectedCube1.coordinates, [0, -1, 1]) || arraysEqual(this.selectedCube1.coordinates, [0, 0, 1])) &&
            (arraysEqual(this.selectedCube2.coordinates, [0, 0, 1]) || arraysEqual(this.selectedCube2.coordinates, [0, 1, 1]))) {
            if (this.selectedFace1 === this.selectedFace2) {
                if (this.selectedFace1 === 1) rubiksCube.pushTurn("m");
            }
        }

        // blue
        if ((arraysEqual(this.selectedCube1.coordinates, [0, -1, 1]) || arraysEqual(this.selectedCube1.coordinates, [0, -1, 0])) &&
            (arraysEqual(this.selectedCube2.coordinates, [0, -1, 0]) || arraysEqual(this.selectedCube2.coordinates, [0, -1, -1]))) {
            if (this.selectedFace1 === this.selectedFace2) {
                if (this.selectedFace1 === 6) rubiksCube.pushTurn("M");
            }
        }
        if ((arraysEqual(this.selectedCube1.coordinates, [0, -1, -1]) || arraysEqual(this.selectedCube1.coordinates, [0, -1, 0])) &&
            (arraysEqual(this.selectedCube2.coordinates, [0, -1, 0]) || arraysEqual(this.selectedCube2.coordinates, [0, -1, 1]))) {
            if (this.selectedFace1 === this.selectedFace2) {
                if (this.selectedFace1 === 6) rubiksCube.pushTurn("m");
            }
        }

        // yellow
        if ((arraysEqual(this.selectedCube1.coordinates, [0, -1, -1]) || arraysEqual(this.selectedCube1.coordinates, [0, 0, -1])) &&
            (arraysEqual(this.selectedCube2.coordinates, [0, 0, -1]) || arraysEqual(this.selectedCube2.coordinates, [0, 1, -1]))) {
            if (this.selectedFace1 === this.selectedFace2) {
                if (this.selectedFace1 === 3) rubiksCube.pushTurn("M");
            }
        }
        if ((arraysEqual(this.selectedCube1.coordinates, [0, 1, -1]) || arraysEqual(this.selectedCube1.coordinates, [0, 0, -1])) &&
            (arraysEqual(this.selectedCube2.coordinates, [0, 0, -1]) || arraysEqual(this.selectedCube2.coordinates, [0, -1, -1]))) {
            if (this.selectedFace1 === this.selectedFace2) {
                if (this.selectedFace1 === 3) rubiksCube.pushTurn("m");
            }
        }

        // green
        if ((arraysEqual(this.selectedCube1.coordinates, [-1, 1, 0]) || arraysEqual(this.selectedCube1.coordinates, [0, 1, 0])) &&
            (arraysEqual(this.selectedCube2.coordinates, [0, 1, 0]) || arraysEqual(this.selectedCube2.coordinates, [1, 1, 0]))) {
            if (this.selectedFace1 === this.selectedFace2) {
                if (this.selectedFace1 === 5) rubiksCube.pushTurn("S");
            }
        }
        if ((arraysEqual(this.selectedCube1.coordinates, [1, 1, 0]) || arraysEqual(this.selectedCube1.coordinates, [0, 1, 0])) &&
            (arraysEqual(this.selectedCube2.coordinates, [0, 1, 0]) || arraysEqual(this.selectedCube2.coordinates, [-1, 1, 0]))) {
            if (this.selectedFace1 === this.selectedFace2) {
                if (this.selectedFace1 === 5) rubiksCube.pushTurn("s");
            }
        }

        // red
        if ((arraysEqual(this.selectedCube1.coordinates, [-1, -1, 0]) || arraysEqual(this.selectedCube1.coordinates, [-1, 0, 0])) &&
            (arraysEqual(this.selectedCube2.coordinates, [-1, 0, 0]) || arraysEqual(this.selectedCube2.coordinates, [-1, 1, 0]))) {
            if (this.selectedFace1 === this.selectedFace2) {
                if (this.selectedFace1 === 4) rubiksCube.pushTurn("S");
            }
        }
        if ((arraysEqual(this.selectedCube1.coordinates, [-1, 1, 0]) || arraysEqual(this.selectedCube1.coordinates, [-1, 0, 0])) &&
            (arraysEqual(this.selectedCube2.coordinates, [-1, 0, 0]) || arraysEqual(this.selectedCube2.coordinates, [-1, -1, 0]))) {
            if (this.selectedFace1 === this.selectedFace2) {
                if (this.selectedFace1 === 4) rubiksCube.pushTurn("s");
            }
        }

        // blue
        if ((arraysEqual(this.selectedCube1.coordinates, [1, -1, 0]) || arraysEqual(this.selectedCube1.coordinates, [0, -1, 0])) &&
            (arraysEqual(this.selectedCube2.coordinates, [0, -1, 0]) || arraysEqual(this.selectedCube2.coordinates, [-1, -1, 0]))) {
            if (this.selectedFace1 === this.selectedFace2) {
                if (this.selectedFace1 === 6) rubiksCube.pushTurn("S");
            }
        }
        if ((arraysEqual(this.selectedCube1.coordinates, [-1, -1, 0]) || arraysEqual(this.selectedCube1.coordinates, [0, -1, 0])) &&
            (arraysEqual(this.selectedCube2.coordinates, [0, -1, 0]) || arraysEqual(this.selectedCube2.coordinates, [1, -1, 0]))) {
            if (this.selectedFace1 === this.selectedFace2) {
                if (this.selectedFace1 === 6) rubiksCube.pushTurn("s");
            }
        }

        // orange
        if ((arraysEqual(this.selectedCube1.coordinates, [1, 1, 0]) || arraysEqual(this.selectedCube1.coordinates, [1, 0, 0])) &&
            (arraysEqual(this.selectedCube2.coordinates, [1, 0, 0]) || arraysEqual(this.selectedCube2.coordinates, [1, -1, 0]))) {
            if (this.selectedFace1 === this.selectedFace2) {
                if (this.selectedFace1 === 2) rubiksCube.pushTurn("S");
            }
        }
        if ((arraysEqual(this.selectedCube1.coordinates, [1, -1, 0]) || arraysEqual(this.selectedCube1.coordinates, [1, 0, 0])) &&
            (arraysEqual(this.selectedCube2.coordinates, [1, 0, 0]) || arraysEqual(this.selectedCube2.coordinates, [1, 1, 0]))) {
            if (this.selectedFace1 === this.selectedFace2) {
                if (this.selectedFace1 === 2) rubiksCube.pushTurn("s");
            }
        }

        // white
        if ((arraysEqual(this.selectedCube1.coordinates, [-1, 0, 1]) || arraysEqual(this.selectedCube1.coordinates, [0, 0, 1])) &&
            (arraysEqual(this.selectedCube2.coordinates, [0, 0, 1]) || arraysEqual(this.selectedCube2.coordinates, [1, 0, 1]))) {
            if (this.selectedFace1 === this.selectedFace2) {
                if (this.selectedFace1 === 1) rubiksCube.pushTurn("E");
            }
        }
        if ((arraysEqual(this.selectedCube1.coordinates, [1, 0, 1]) || arraysEqual(this.selectedCube1.coordinates, [0, 0, 1])) &&
            (arraysEqual(this.selectedCube2.coordinates, [0, 0, 1]) || arraysEqual(this.selectedCube2.coordinates, [-1, 0, 1]))) {
            if (this.selectedFace1 === this.selectedFace2) {
                if (this.selectedFace1 === 1) rubiksCube.pushTurn("e");
            }
        }

        // orange
        if ((arraysEqual(this.selectedCube1.coordinates, [1, 0, 1]) || arraysEqual(this.selectedCube1.coordinates, [1, 0, 0])) &&
            (arraysEqual(this.selectedCube2.coordinates, [1, 0, 0]) || arraysEqual(this.selectedCube2.coordinates, [1, 0, -1]))) {
            if (this.selectedFace1 === this.selectedFace2) {
                if (this.selectedFace1 === 2) rubiksCube.pushTurn("E");
            }
        }
        if ((arraysEqual(this.selectedCube1.coordinates, [1, 0, -1]) || arraysEqual(this.selectedCube1.coordinates, [1, 0, 0])) &&
            (arraysEqual(this.selectedCube2.coordinates, [1, 0, 0]) || arraysEqual(this.selectedCube2.coordinates, [1, 0, 1]))) {
            if (this.selectedFace1 === this.selectedFace2) {
                if (this.selectedFace1 === 2) rubiksCube.pushTurn("e");
            }
        }

        // yellow
        if ((arraysEqual(this.selectedCube1.coordinates, [1, 0, -1]) || arraysEqual(this.selectedCube1.coordinates, [0, 0, -1])) &&
            (arraysEqual(this.selectedCube2.coordinates, [0, 0, -1]) || arraysEqual(this.selectedCube2.coordinates, [-1, 0, -1]))) {
            if (this.selectedFace1 === this.selectedFace2) {
                if (this.selectedFace1 === 3) rubiksCube.pushTurn("E");
            }
        }
        if ((arraysEqual(this.selectedCube1.coordinates, [-1, 0, -1]) || arraysEqual(this.selectedCube1.coordinates, [0, 0, -1])) &&
            (arraysEqual(this.selectedCube2.coordinates, [0, 0, -1]) || arraysEqual(this.selectedCube2.coordinates, [1, 0, -1]))) {
            if (this.selectedFace1 === this.selectedFace2) {
                if (this.selectedFace1 === 3) rubiksCube.pushTurn("e");
            }
        }

        // red
        if ((arraysEqual(this.selectedCube1.coordinates, [-1, 0, -1]) || arraysEqual(this.selectedCube1.coordinates, [-1, 0, 0])) &&
            (arraysEqual(this.selectedCube2.coordinates, [-1, 0, 0]) || arraysEqual(this.selectedCube2.coordinates, [-1, 0, 1]))) {
            if (this.selectedFace1 === this.selectedFace2) {
                if (this.selectedFace1 === 4) rubiksCube.pushTurn("E");
            }
        }
        if ((arraysEqual(this.selectedCube1.coordinates, [-1, 0, 1]) || arraysEqual(this.selectedCube1.coordinates, [-1, 0, 0])) &&
            (arraysEqual(this.selectedCube2.coordinates, [-1, 0, 0]) || arraysEqual(this.selectedCube2.coordinates, [-1, 0, -1]))) {
            if (this.selectedFace1 === this.selectedFace2) {
                if (this.selectedFace1 === 4) rubiksCube.pushTurn("e");
            }
        }
    }

    // option 0 = draw rubik's cube
    // option 1 = draw different alpha for mini-cube selector
    // option 2 = draw different cube for face selector
    draw(option) {
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        eye = vec3(radius * Math.sin(phi) * Math.sin(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.cos(theta));
        modelViewMatrix = lookAt(eye, at, up);
        projectionMatrix = perspective(FOV, aspect, near, far);
        if (option === 0) {
            let cnt = 0;
            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 3; j++) {
                    for (let k = 0; k < 3; k++) {
                        cnt++;
                        if (i === 1 && j === 1 && k === 1) continue;
                        this.cubes[i][j][k].draw(cnt);
                    }
                }
            }
        } else if (option === 1) {
            setMatrixToProgram();
            gl.bindBuffer(gl.ARRAY_BUFFER, rubiksCube.cubeVerticesBuffer);
            gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, rubiksCube.cubeSelectBuffer);
            gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);
            gl.drawArrays(gl.TRIANGLES, 0, rubiksCube.cubeVertices.length);

        } else if (option === 2) {
            setMatrixToProgram();
            gl.bindBuffer(gl.ARRAY_BUFFER, rubiksCube.cubeFaceVerticesBuffer);
            gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, rubiksCube.cubeFaceBuffer);
            gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);
            gl.drawArrays(gl.TRIANGLES, 0, rubiksCube.cubeFaceVertices.length);
        }
    }

    // select Face with color from option==2 draw
    selectFace(x, y) {
        const pixelColor = new Uint8Array(4);
        rubiksCube.draw(2);
        gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixelColor);
        const r = pixelColor[0];
        const g = pixelColor[1];
        const b = pixelColor[2];
        return FACE[r][g][b];
        // console.log(axis);
    }

    // select mini-cube with alpha from option==1 draw
    selectCube(x, y) {
        const pixelColor = new Uint8Array(4);
        rubiksCube.draw(1);
        gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixelColor);
        const r = pixelColor[0];
        const g = pixelColor[1];
        const b = pixelColor[2];
        const a = pixelColor[3];
        if (r === 26 && g === 26 && b === 26) {
            return null;
        } else {
            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 3; j++) {
                    for (let k = 0; k < 3; k++) {
                        if (a === this.cubes[i][j][k].alphaCheck) {
                            if (this.selectedCube1 && this.selectedCube1 !== this.cubes[i][j][k]) {
                                this.selectedCube2 = this.cubes[i][j][k];
                                this.selectedFace2 = this.selectFace(x, y);
                                return true;
                            } else {
                                this.selectedCube1 = this.cubes[i][j][k];
                                this.selectedFace1 = this.selectFace(x, y);
                                return true;
                            }
                        }
                    }
                }
            }
            return true;
        }
    }

    // after rotation change the cube position
    changeCubePosition(face) {
        let temp;
        for (let x = 0; x < 3; x++) {
            for (let y = 0; y < 3; y++) {
                for (let z = 0; z < 3; z++) {
                    switch (face) {
                        case "L":
                            if (this.cubes[x][y][z].cubePosition[0] === -1) {
                                temp = this.cubes[x][y][z].cubePosition[2];
                                this.cubes[x][y][z].cubePosition[2] = this.cubes[x][y][z].cubePosition[1];
                                this.cubes[x][y][z].cubePosition[1] = -temp;

                                temp = this.cubes[x][y][z].rotationAxis[1];
                                this.cubes[x][y][z].rotationAxis[1] = negate(this.cubes[x][y][z].rotationAxis[2]);
                                this.cubes[x][y][z].rotationAxis[2] = temp;
                            }
                            break;
                        case "l":
                            if (this.cubes[x][y][z].cubePosition[0] === -1) {
                                temp = this.cubes[x][y][z].cubePosition[1];
                                this.cubes[x][y][z].cubePosition[1] = this.cubes[x][y][z].cubePosition[2];
                                this.cubes[x][y][z].cubePosition[2] = -temp;

                                temp = this.cubes[x][y][z].rotationAxis[2];
                                this.cubes[x][y][z].rotationAxis[2] = negate(this.cubes[x][y][z].rotationAxis[1]);
                                this.cubes[x][y][z].rotationAxis[1] = temp;
                            }
                            break;
                        case "R":
                            if (this.cubes[x][y][z].cubePosition[0] === 1) {
                                temp = this.cubes[x][y][z].cubePosition[1];
                                this.cubes[x][y][z].cubePosition[1] = this.cubes[x][y][z].cubePosition[2];
                                this.cubes[x][y][z].cubePosition[2] = -temp;

                                temp = this.cubes[x][y][z].rotationAxis[2];
                                this.cubes[x][y][z].rotationAxis[2] = negate(this.cubes[x][y][z].rotationAxis[1]);
                                this.cubes[x][y][z].rotationAxis[1] = temp;
                            }
                            break;
                        case "r":
                            if (this.cubes[x][y][z].cubePosition[0] === 1) {
                                temp = this.cubes[x][y][z].cubePosition[2];
                                this.cubes[x][y][z].cubePosition[2] = this.cubes[x][y][z].cubePosition[1];
                                this.cubes[x][y][z].cubePosition[1] = -temp;


                                temp = this.cubes[x][y][z].rotationAxis[1];
                                this.cubes[x][y][z].rotationAxis[1] = negate(this.cubes[x][y][z].rotationAxis[2]);
                                this.cubes[x][y][z].rotationAxis[2] = temp;
                            }
                            break;
                        case "U":
                            if (this.cubes[x][y][z].cubePosition[1] === 1) {
                                temp = this.cubes[x][y][z].cubePosition[2];
                                this.cubes[x][y][z].cubePosition[2] = this.cubes[x][y][z].cubePosition[0];
                                this.cubes[x][y][z].cubePosition[0] = -temp;

                                temp = this.cubes[x][y][z].rotationAxis[0];
                                this.cubes[x][y][z].rotationAxis[0] = negate(this.cubes[x][y][z].rotationAxis[2]);
                                this.cubes[x][y][z].rotationAxis[2] = temp;
                            }
                            break;
                        case "u":
                            if (this.cubes[x][y][z].cubePosition[1] === 1) {
                                temp = this.cubes[x][y][z].cubePosition[0];
                                this.cubes[x][y][z].cubePosition[0] = this.cubes[x][y][z].cubePosition[2];
                                this.cubes[x][y][z].cubePosition[2] = -temp;

                                temp = this.cubes[x][y][z].rotationAxis[2];
                                this.cubes[x][y][z].rotationAxis[2] = negate(this.cubes[x][y][z].rotationAxis[0]);
                                this.cubes[x][y][z].rotationAxis[0] = temp;
                            }
                            break;
                        case "D":
                            if (this.cubes[x][y][z].cubePosition[1] === -1) {
                                temp = this.cubes[x][y][z].cubePosition[0];
                                this.cubes[x][y][z].cubePosition[0] = this.cubes[x][y][z].cubePosition[2];
                                this.cubes[x][y][z].cubePosition[2] = -temp;

                                temp = this.cubes[x][y][z].rotationAxis[2];
                                this.cubes[x][y][z].rotationAxis[2] = negate(this.cubes[x][y][z].rotationAxis[0]);
                                this.cubes[x][y][z].rotationAxis[0] = temp;
                            }
                            break;
                        case "d":
                            if (this.cubes[x][y][z].cubePosition[1] === -1) {
                                temp = this.cubes[x][y][z].cubePosition[2];
                                this.cubes[x][y][z].cubePosition[2] = this.cubes[x][y][z].cubePosition[0];
                                this.cubes[x][y][z].cubePosition[0] = -temp;

                                temp = this.cubes[x][y][z].rotationAxis[0];
                                this.cubes[x][y][z].rotationAxis[0] = negate(this.cubes[x][y][z].rotationAxis[2]);
                                this.cubes[x][y][z].rotationAxis[2] = temp;
                            }
                            break;
                        case "E":
                            if (this.cubes[x][y][z].cubePosition[1] === 0) {
                                temp = this.cubes[x][y][z].cubePosition[0];
                                this.cubes[x][y][z].cubePosition[0] = this.cubes[x][y][z].cubePosition[2];
                                this.cubes[x][y][z].cubePosition[2] = -temp;

                                temp = this.cubes[x][y][z].rotationAxis[2];
                                this.cubes[x][y][z].rotationAxis[2] = negate(this.cubes[x][y][z].rotationAxis[0]);
                                this.cubes[x][y][z].rotationAxis[0] = temp;
                            }
                            break;
                        case "e":
                            if (this.cubes[x][y][z].cubePosition[1] === 0) {
                                temp = this.cubes[x][y][z].cubePosition[2];
                                this.cubes[x][y][z].cubePosition[2] = this.cubes[x][y][z].cubePosition[0];
                                this.cubes[x][y][z].cubePosition[0] = -temp;

                                temp = this.cubes[x][y][z].rotationAxis[0];
                                this.cubes[x][y][z].rotationAxis[0] = negate(this.cubes[x][y][z].rotationAxis[2]);
                                this.cubes[x][y][z].rotationAxis[2] = temp;
                            }
                            break;
                        case "F":
                            if (this.cubes[x][y][z].cubePosition[2] === 1) {
                                temp = this.cubes[x][y][z].cubePosition[0];
                                this.cubes[x][y][z].cubePosition[0] = this.cubes[x][y][z].cubePosition[1];
                                this.cubes[x][y][z].cubePosition[1] = -temp;

                                temp = this.cubes[x][y][z].rotationAxis[1];
                                this.cubes[x][y][z].rotationAxis[1] = negate(this.cubes[x][y][z].rotationAxis[0]);
                                this.cubes[x][y][z].rotationAxis[0] = temp;
                            }
                            break;
                        case "f":
                            if (this.cubes[x][y][z].cubePosition[2] === 1) {
                                temp = this.cubes[x][y][z].cubePosition[1];
                                this.cubes[x][y][z].cubePosition[1] = this.cubes[x][y][z].cubePosition[0];
                                this.cubes[x][y][z].cubePosition[0] = -temp;

                                temp = this.cubes[x][y][z].rotationAxis[0];
                                this.cubes[x][y][z].rotationAxis[0] = negate(this.cubes[x][y][z].rotationAxis[1]);
                                this.cubes[x][y][z].rotationAxis[1] = temp;
                            }
                            break;
                        case "S":
                            if (this.cubes[x][y][z].cubePosition[2] === 0) {
                                temp = this.cubes[x][y][z].cubePosition[0];
                                this.cubes[x][y][z].cubePosition[0] = this.cubes[x][y][z].cubePosition[1];
                                this.cubes[x][y][z].cubePosition[1] = -temp;

                                temp = this.cubes[x][y][z].rotationAxis[1];
                                this.cubes[x][y][z].rotationAxis[1] = negate(this.cubes[x][y][z].rotationAxis[0]);
                                this.cubes[x][y][z].rotationAxis[0] = temp;
                            }
                            break;
                        case "s":
                            if (this.cubes[x][y][z].cubePosition[2] === 0) {
                                temp = this.cubes[x][y][z].cubePosition[1];
                                this.cubes[x][y][z].cubePosition[1] = this.cubes[x][y][z].cubePosition[0];
                                this.cubes[x][y][z].cubePosition[0] = -temp;

                                temp = this.cubes[x][y][z].rotationAxis[0];
                                this.cubes[x][y][z].rotationAxis[0] = negate(this.cubes[x][y][z].rotationAxis[1]);
                                this.cubes[x][y][z].rotationAxis[1] = temp;
                            }
                            break;
                        case "B":
                            if (this.cubes[x][y][z].cubePosition[2] === -1) {
                                temp = this.cubes[x][y][z].cubePosition[1];
                                this.cubes[x][y][z].cubePosition[1] = this.cubes[x][y][z].cubePosition[0];
                                this.cubes[x][y][z].cubePosition[0] = -temp;

                                temp = this.cubes[x][y][z].rotationAxis[0];
                                this.cubes[x][y][z].rotationAxis[0] = negate(this.cubes[x][y][z].rotationAxis[1]);
                                this.cubes[x][y][z].rotationAxis[1] = temp;
                            }
                            break;
                        case "b":
                            if (this.cubes[x][y][z].cubePosition[2] === -1) {
                                temp = this.cubes[x][y][z].cubePosition[0];
                                this.cubes[x][y][z].cubePosition[0] = this.cubes[x][y][z].cubePosition[1];
                                this.cubes[x][y][z].cubePosition[1] = -temp;

                                temp = this.cubes[x][y][z].rotationAxis[1];
                                this.cubes[x][y][z].rotationAxis[1] = negate(this.cubes[x][y][z].rotationAxis[0]);
                                this.cubes[x][y][z].rotationAxis[0] = temp;
                            }
                            break;
                        case "M":
                            if (this.cubes[x][y][z].cubePosition[0] === 0) {
                                temp = this.cubes[x][y][z].cubePosition[2];
                                this.cubes[x][y][z].cubePosition[2] = this.cubes[x][y][z].cubePosition[1];
                                this.cubes[x][y][z].cubePosition[1] = -temp;

                                temp = this.cubes[x][y][z].rotationAxis[1];
                                this.cubes[x][y][z].rotationAxis[1] = negate(this.cubes[x][y][z].rotationAxis[2]);
                                this.cubes[x][y][z].rotationAxis[2] = temp;
                            }
                            break;
                        case "m":
                            if (this.cubes[x][y][z].cubePosition[0] === 0) {
                                temp = this.cubes[x][y][z].cubePosition[1];
                                this.cubes[x][y][z].cubePosition[1] = this.cubes[x][y][z].cubePosition[2];
                                this.cubes[x][y][z].cubePosition[2] = -temp;

                                temp = this.cubes[x][y][z].rotationAxis[2];
                                this.cubes[x][y][z].rotationAxis[2] = negate(this.cubes[x][y][z].rotationAxis[1]);
                                this.cubes[x][y][z].rotationAxis[1] = temp;
                            }
                    }
                }
            }
        }
    }

    // push turn to queue and storage
    pushTurn(face) {
        this.storage.push(face);
        this.queue.push(face);
    }

    // animate turn in the queue with interval and timer
    animate(action) {
        const self = this;
        interval = setInterval(() => {
            self.callRotation(action)
        }, timer);
    }

    // rotate and after rotation check if the cube has been solved
    callRotation(face) {
        this.turn(face);
        currentTheta += rotateTheta;
        if (currentTheta === 90) {
            clearInterval(interval);
            isFaceRotating = false;
            currentTheta = 0;
            this.changeCubePosition(face);
            if (this.checkSolved()) {
                alert("Rubik's Cube Solved");
            }
        }
    }

    // check if the cube has been solved
    // get default orientation from the center mini-cube and check if the rubik's cube is solved
    checkSolved() {
        const defaultOrientation = this.cubes[0][0][0].rotationAxis;
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                for (let x = 0; x < 3; x++) {
                    for (let y = 0; y < 3; y++) {
                        for (let z = 0; z < 3; z++) {
                            if (this.cubes[x][y][z].rotationAxis[i][j] !== defaultOrientation[i][j]) {
                                if (x === 1 && z === 1) {
                                    if (this.cubes[x][y][z].rotationAxis[1][j] !== defaultOrientation[1][j]) {
                                        return false;
                                    }
                                } else if (x === 1 && y === 1) {
                                    if (this.cubes[x][y][z].rotationAxis[2][j] !== defaultOrientation[2][j]) {
                                        return false;
                                    }
                                } else if (y === 1 && z === 1) {
                                    if (this.cubes[x][y][z].rotationAxis[0][j] !== defaultOrientation[0][j]) {
                                        return false;
                                    }
                                } else {
                                    return false;
                                }
                            }
                        }
                    }
                }
            }
        }
        return true;
    }

    // determine rotation axis and location of mini-cube and
    // update rotation matrix for mini-cubes that need to rotate
    turn(face) {
        let direction, value, mainAxis;
        switch (face) {
            case "L":
                mainAxis = 0;
                value = -1;
                direction = "L";
                break;
            case "l":
                mainAxis = 0;
                value = -1;
                direction = 0;
                break;
            case "R":
                mainAxis = 0;
                value = 1;
                direction = 0;
                break;
            case "r":
                mainAxis = 0;
                value = 1;
                direction = "r";
                break;
            case "M":
                mainAxis = 0;
                value = 0;
                direction = "M";
                break;
            case "m":
                mainAxis = 0;
                value = 0;
                direction = 0;
                break;
            case "U":
                mainAxis = 1;
                value = 1;
                direction = 0;
                break;
            case "u":
                mainAxis = 1;
                value = 1;
                direction = "u";
                break;
            case "D":
                mainAxis = 1;
                value = -1;
                direction = "D";
                break;
            case "d":
                mainAxis = 1;
                value = -1;
                direction = 0;
                break;
            case "E":
                mainAxis = 1;
                value = 0;
                direction = "E";
                break;
            case "e":
                mainAxis = 1;
                value = 0;
                direction = 0;
                break;
            case "F":
                mainAxis = 2;
                value = 1;
                direction = 0;
                break;
            case "f":
                mainAxis = 2;
                value = 1;
                direction = "f";
                break;
            case "B":
                mainAxis = 2;
                value = -1;
                direction = "B";
                break;
            case "b":
                mainAxis = 2;
                value = -1;
                direction = 0;
                break;
            case "S":
                mainAxis = 2;
                value = 0;
                direction = 0;
                break;
            case "s":
                mainAxis = 2;
                value = 0;
                direction = "s";
                break;
        }
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                for (let k = 0; k < 3; k++) {
                    let rtMatrix = rubiksCube.cubes[i][j][k].rotationMatrix;
                    if (rubiksCube.cubes[i][j][k].cubePosition[mainAxis] === value) {
                        if (!direction) {
                            rtMatrix = mult(rtMatrix, rotate(rotateTheta, rubiksCube.cubes[i][j][k].rotationAxis[mainAxis]));
                        } else {
                            rtMatrix = mult(rtMatrix, rotate(rotateTheta, negate(rubiksCube.cubes[i][j][k].rotationAxis[mainAxis])));
                        }
                        rubiksCube.cubes[i][j][k].rotationMatrix = rtMatrix;
                    }
                }
            }
        }
    }

    // build face picker cube
    buildFaceCube() {
        this.normalQuad(1, 0, 3, 2);
        this.normalQuad(2, 3, 7, 6);
        this.normalQuad(3, 0, 4, 7);
        this.normalQuad(6, 5, 1, 2);
        this.normalQuad(4, 5, 6, 7);
        this.normalQuad(5, 4, 0, 1);
    }

    // build face picker cube
    normalQuad(a, b, c, d) {
        const vertices = [
            vec4(-0.45, -0.45, 0.45, 1.0),
            vec4(-0.45, 0.45, 0.45, 1.0),
            vec4(0.45, 0.45, 0.45, 1.0),
            vec4(0.45, -0.45, 0.45, 1.0),
            vec4(-0.45, -0.45, -0.45, 1.0),
            vec4(-0.45, 0.45, -0.45, 1.0),
            vec4(0.45, 0.45, -0.45, 1.0),
            vec4(0.45, -0.45, -0.45, 1.0)
        ];

        const vertexColors = [
            [0.0, 0.0, 0.0, 1.0],  // black
            [1.0, 0.0, 0.0, 1.0],  // red
            [1.0, 1.0, 0.0, 1.0],  // yellow
            [0.0, 1.0, 0.0, 1.0],  // green
            [0.0, 0.0, 1.0, 1.0],  // blue
            [1.0, 0.0, 1.0, 1.0],  // magenta
            [0.0, 1.0, 1.0, 1.0],  // cyan
            [1.0, 1.0, 1.0, 1.0]   // white
        ];

        const indices = [a, b, c, a, c, d];

        for (let i = 0; i < indices.length; i++) {
            this.cubeFaceVertices.push(vertices[indices[i]]);
            this.cubeFaces.push(vertexColors[a]);
        }
    }

    // save turns to text file
    save() {
        saveText.value = JSON.stringify({
            turns: this.storage
        });
    }

    // shuffle the cube
    shuffle(shuffleNum) {
        console.log(shuffleNum);
        if (!isNaN(shuffleNum) && shuffleNum !== 0) {
            console.log(shuffleNum);
            for (let i = 0; i < shuffleNum; i++) {
                let rng = Math.round(Math.random() * MOVES.length) % MOVES.length;
                this.pushTurn(MOVES[rng]);
            }
        }
    }
}

// class for each mini cube
class Cube {
    constructor(rubiksCube, coordinates) {
        this.coordinates = [...coordinates];
        this.cubePosition = [...coordinates];
        this.rotationAxis = [vec3(-1, 0, 0), vec3(0, -1, 0), vec3(0, 0, -1)];
        this.color = COLORS.black;
        this.rubiksCube = rubiksCube;
        this.rotationMatrix = mat4();
        // for mini-cube selector
        this.alpha = 0.031 * (9 * (this.coordinates[0] + 1) + 3 * (this.coordinates[1] + 1) + (this.coordinates[2] + 1));
        this.alphaCheck = Math.round(255 * 0.031 * (9 * (this.coordinates[0] + 1) + 3 * (this.coordinates[1] + 1) + (this.coordinates[2] + 1)));
        this.buildCube(coordinates);
    }

    buildCube(coordinate) {
        cubeIndices.push(this.rubiksCube.cubeVertices.length);
        stickerIndices.push(this.rubiksCube.stickerVertices.length);
        this.quad(1, 0, 3, 2, coordinate);
        this.quad(2, 3, 7, 6, coordinate);
        this.quad(3, 0, 4, 7, coordinate);
        this.quad(6, 5, 1, 2, coordinate);
        this.quad(4, 5, 6, 7, coordinate);
        this.quad(5, 4, 0, 1, coordinate);
        this.createSticker(coordinate);
    }

    // generate vertex and color
    quad(a, b, c, d, coordinate) {
        const xOff = coordinate[0] * this.rubiksCube.cubeSize;
        const yOff = coordinate[1] * this.rubiksCube.cubeSize;
        const zOff = coordinate[2] * this.rubiksCube.cubeSize;
        const cubeVertices = [
            vec4(this.rubiksCube.starts.x + xOff, this.rubiksCube.starts.y + yOff, this.rubiksCube.ends.z + zOff, 1.0),
            vec4(this.rubiksCube.starts.x + xOff, this.rubiksCube.ends.y + yOff, this.rubiksCube.ends.z + zOff, 1.0),
            vec4(this.rubiksCube.ends.x + xOff, this.rubiksCube.ends.y + yOff, this.rubiksCube.ends.z + zOff),
            vec4(this.rubiksCube.ends.x + xOff, this.rubiksCube.starts.y + yOff, this.rubiksCube.ends.z + zOff, 1.0),
            vec4(this.rubiksCube.starts.x + xOff, this.rubiksCube.starts.y + yOff, this.rubiksCube.starts.z + zOff, 1.0),
            vec4(this.rubiksCube.starts.x + xOff, this.rubiksCube.ends.y + yOff, this.rubiksCube.starts.z + zOff, 1.0),
            vec4(this.rubiksCube.ends.x + xOff, this.rubiksCube.ends.y + yOff, this.rubiksCube.starts.z + zOff, 1.0),
            vec4(this.rubiksCube.ends.x + xOff, this.rubiksCube.starts.y + yOff, this.rubiksCube.starts.z + zOff, 1.0)
        ];

        const indices = [a, b, c, a, c, d];

        for (let i = 0; i < indices.length; i++) {
            this.rubiksCube.cubeVertices.push(cubeVertices[indices[i]]);
            this.rubiksCube.cubeColors.push(this.color);
            this.rubiksCube.cubeSelects.push([0, 0, 0, this.alpha]);
        }
    }

    // generate sticker vertices and color
    stickerQuad(a, b, c, d, coordinate, xMargin, yMargin, zMargin) {
        const xOff = coordinate[0] * this.rubiksCube.cubeSize;
        const yOff = coordinate[1] * this.rubiksCube.cubeSize;
        const zOff = coordinate[2] * this.rubiksCube.cubeSize;

        const cubeVertices = [
            vec4(this.rubiksCube.starts.x + xOff + xMargin, this.rubiksCube.starts.y + yMargin + yOff, this.rubiksCube.ends.z + zMargin + zOff, 1.0),
            vec4(this.rubiksCube.starts.x + xOff + xMargin, this.rubiksCube.ends.y + yMargin + yOff, this.rubiksCube.ends.z + zMargin + zOff, 1.0),
            vec4(this.rubiksCube.ends.x + xOff + xMargin, this.rubiksCube.ends.y + yMargin + yOff, this.rubiksCube.ends.z + zMargin + zOff),
            vec4(this.rubiksCube.ends.x + xOff + xMargin, this.rubiksCube.starts.y + yMargin + yOff, this.rubiksCube.ends.z + zMargin + zOff, 1.0),
            vec4(this.rubiksCube.starts.x + xOff + xMargin, this.rubiksCube.starts.y + yMargin + yOff, this.rubiksCube.starts.z + zMargin + zOff, 1.0),
            vec4(this.rubiksCube.starts.x + xOff + xMargin, this.rubiksCube.ends.y + yMargin + yOff, this.rubiksCube.starts.z + zMargin + zOff, 1.0),
            vec4(this.rubiksCube.ends.x + xOff + xMargin, this.rubiksCube.ends.y + yMargin + yOff, this.rubiksCube.starts.z + zMargin + zOff, 1.0),
            vec4(this.rubiksCube.ends.x + xOff + xMargin, this.rubiksCube.starts.y + yMargin + yOff, this.rubiksCube.starts.z + zMargin + zOff, 1.0)
        ];
        const indices = [a, b, c, a, c, d];
        for (let i = 0; i < indices.length; ++i) {
            this.rubiksCube.stickerVertices.push(cubeVertices[indices[i]]);
        }
    }

    createSticker(coordinate) {
        const x = coordinate[0];
        const y = coordinate[1];
        const z = coordinate[2];
        if (x === -1) {
            // console.log("red");
            const xMargin = -0.005;
            const yMargin = coordinate[1] * stickerMargin;
            const zMargin = coordinate[2] * stickerMargin;
            this.stickerQuad(5, 4, 0, 1, coordinate, xMargin, yMargin, zMargin);
            for (let i = 0; i < 6; i++) {
                this.rubiksCube.stickerColors.push(COLORS.red);
            }
        } else if (x === 1) {
            // console.log("orange");
            const xMargin = 0.005;
            const yMargin = coordinate[1] * stickerMargin;
            const zMargin = coordinate[2] * stickerMargin;
            this.stickerQuad(2, 3, 7, 6, coordinate, xMargin, yMargin, zMargin);
            for (let i = 0; i < 6; i++) {
                this.rubiksCube.stickerColors.push(COLORS.orange);
            }
        }

        if (y === -1) {
            // console.log("blue");
            const xMargin = coordinate[0] * stickerMargin;
            const yMargin = -0.005;
            const zMargin = coordinate[2] * stickerMargin;
            this.stickerQuad(3, 0, 4, 7, coordinate, xMargin, yMargin, zMargin);
            for (let i = 0; i < 6; i++) {
                this.rubiksCube.stickerColors.push(COLORS.blue);
            }
        } else if (y === 1) {
            // console.log("green");
            const xMargin = coordinate[0] * stickerMargin;
            const yMargin = 0.005;
            const zMargin = coordinate[2] * stickerMargin;
            this.stickerQuad(6, 5, 1, 2, coordinate, xMargin, yMargin, zMargin);
            for (let i = 0; i < 6; i++) {
                this.rubiksCube.stickerColors.push(COLORS.green);
            }
        }

        if (z === -1) {
            // console.log("yellow");
            const xMargin = coordinate[0] * stickerMargin;
            const yMargin = coordinate[1] * stickerMargin;
            const zMargin = -0.005;
            this.stickerQuad(4, 5, 6, 7, coordinate, xMargin, yMargin, zMargin);
            for (let i = 0; i < 6; i++) {
                this.rubiksCube.stickerColors.push(COLORS.yellow);
            }
        } else if (z === 1) {
            // console.log("white");
            const xMargin = coordinate[0] * stickerMargin;
            const yMargin = coordinate[1] * stickerMargin;
            const zMargin = 0.005;
            this.stickerQuad(1, 0, 3, 2, coordinate, xMargin, yMargin, zMargin);
            for (let i = 0; i < 6; i++) {
                this.rubiksCube.stickerColors.push(COLORS.white);
            }
        }
    }

    // update modelViewMatrix differently for each mini-cube
    transform() {
        modelViewMatrix = mult(modelViewMatrix, this.rotationMatrix);
    }

    // draw each mini-cube and the location of mini-cube in buffer is determined with idx
    // update modelViewMatrix differently for each mini-cube
    draw(idx) {
        let mvMatrix = modelViewMatrix;
        this.transform();
        setMatrixToProgram();

        gl.bindBuffer(gl.ARRAY_BUFFER, rubiksCube.cubeVerticesBuffer);
        gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, rubiksCube.cubeColorsBuffer);
        gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLES, cubeIndices[idx - 1], cubeIndices[idx] - cubeIndices[idx - 1]);

        gl.bindBuffer(gl.ARRAY_BUFFER, rubiksCube.stickerVerticesBuffer);
        gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, rubiksCube.stickerColorsBuffer);
        gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLES, stickerIndices[idx - 1], stickerIndices[idx] - stickerIndices[idx - 1]);

        modelViewMatrix = mvMatrix;
    }
}

// update modelViewMatrix and projectionMatrix to WebGL
function setMatrixToProgram() {
    const projectionUniform = gl.getUniformLocation(program, "projectionMatrix");
    gl.uniformMatrix4fv(projectionUniform, false, flatten(projectionMatrix));
    const modelViewUniform = gl.getUniformLocation(program, "modelViewMatrix");
    gl.uniformMatrix4fv(modelViewUniform, false, flatten(modelViewMatrix));
}

// right mouse to rotate the cube, and left mouse to turn the cube
function startRotate(event) {
    if (isLeftMouse(event)) mouseLeftDown = true;
    else if (isRightMouse(event)) mouseRightDown = true;
    init_x = event.x;
    init_y = event.y;
    if (mouseLeftDown) rubiksCube.selectCube(event.pageX - CANVAS_X_OFFSET, canvas.height - event.pageY + CANVAS_Y_OFFSET);
    if (rubiksCube.selectedCube1 && rubiksCube.selectedCube2) {
        rubiksCube.rotate();
        rubiksCube.selectedCube1 = null;
        rubiksCube.selectedCube2 = null;
        rubiksCube.selectedFace1 = null;
        rubiksCube.selectedFace2 = null;
    } else {
        cubeRotating = true;
    }
}

//// rotate the cube with right mouse
function rotating(event) {
    if (isFaceRotating) return false;
    if (cubeRotating && mouseRightDown) {
        new_x = event.pageX;
        new_y = event.pageY;
        const delta_x = (init_x - new_x) / 3;
        const delta_y = (init_y - new_y) / 3;

        const tmp_phi = Math.abs((phi / Math.PI * 180.0) % 360);

        if (tmp_phi > 180.0 && tmp_phi < 270.0 || phi < 0.0) {
            if ((phi / Math.PI * 180.0) % 360 < -180.0) {
                up = vec3(0.0, 1.0, 0.0);
                theta += -delta_x * 2 * Math.PI / canvas.width;
            } else {
                up = vec3(0.0, -1.0, 0.0);
                theta += delta_x * 2 * Math.PI / canvas.width;
            }
        } else {
            if (tmp_phi > 270.0) {
                up = vec3(0.0, -1.0, 0.0);
                theta += delta_x * 2 * Math.PI / canvas.width;
            } else {
                up = vec3(0.0, 1.0, 0.0);
                theta += -delta_x * 2 * Math.PI / canvas.width;
            }
        }
        phi += -delta_y * 2 * Math.PI / canvas.height;
        init_x = event.pageX;
        init_y = event.pageY;
        event.preventDefault();
    }
}

// stop rotation
function stopRotate(event) {
    mouseLeftDown = false;
    mouseRightDown = false;
}

// negate the vector
function negate(vec) {
    let temp = [];
    for (let i = 0; i < vec.length; i++) {
        temp[i] = -vec[i];
    }
    return temp;
}

// check if the array is equal
function arraysEqual(arr1, arr2) {
    if (arr1.length !== arr2.length)
        return false;
    for (let i = arr1.length; i--;) {
        if (arr1[i] !== arr2[i])
            return false;
    }
    return true;
}

function isLeftMouse(event) {
    return event.button === 0;
}

function isRightMouse(event) {
    return event.button === 2;
}

// reset the cube
function reset() {
    rubiksCube = new RubiksCube();
}

// re-render rotation
function load() {
    if (saveText.value !== "") {
        const loaded = JSON.parse(saveText.value).turns;
        rubiksCube = new RubiksCube();
        loaded.forEach((value) => rubiksCube.pushTurn(value));
    }
}