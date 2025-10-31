import WebGL from "three/addons/capabilities/WebGL.js";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { DragControls } from 'three/addons/controls/DragControls.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';

const shapes = [];

// [!] this might fuck with people tapping with fat pudgy fingers on mobile devices. 
//  Make sure to retest on touchscreen to get appropriate threshold and distinguish
//  the host device type in code at some point.
const mouseClickThreshold = 150; // in ms
const shapeReturnSpeed = 0.03;
const shapeMinProximity = 4;
const shapeMaxProximity = 2;

// Setup
// mouse functionality
const raycaster = new THREE.Raycaster();
// scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xabcdef);
const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.z = 5;
camera.position.y = 2;
// rendererererer
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

if ( WebGL.isWebGL2Available() ) {

  // Initiate function or other initializations here
  mainloop();

} else {

  const warning = WebGL.getWebGL2ErrorMessage();
  document.getElementById( "container" ).appendChild( warning );

}

function mainloop() {
    document.body.appendChild(renderer.domElement);

    // Setup external (yawn) library controls
    const controls = {
        drag: new DragControls( shapes, camera, renderer.domElement ), // drag n' drop
        camera: new OrbitControls( camera, renderer.domElement ) // camera
    };

    controls.drag.addEventListener( 'dragstart', function ( event ) {
        controls.camera.enabled = false;
        event.object.material.emissive.set( 0xaaaaaa );
    });
    controls.drag.addEventListener( 'dragend', function ( event ) {
        controls.camera.enabled = true;
        event.object.material.emissive.set( 0x000000 );
    });

    function animate() {
        for (let shapeIdx in shapes) {
            const shape = shapes[shapeIdx];
            // ambient motion
            shape.rotation.y += 0.005 + (shapeIdx / 1000);

            // slowly move all shapes closer to each other if dragged
            if (shape.lines) {
                for (let i in shape.lines.origin) {
                    let other = shape.lines.origin[i].target;
                    if (shape.position.distanceTo(other.position) > shapeMinProximity) {
                        shape.position.lerpVectors(shape.position, other.position, shapeReturnSpeed)
                        updateLine(shape.lines.origin[i], other.position, shape.position);
                    } else if (shape.position.distanceTo(other.position) < shapeMaxProximity) {
                        let oppositeVec = other.position.clone().negate();
                        shape.position.lerpVectors(shape.position, oppositeVec, shapeReturnSpeed*2);
                        updateLine(shape.lines.origin[i], other.position, shape.position);
                    }
                }
                for (let i in shape.lines.target) {
                    let other = shape.lines.target[i].origin;
                    if (shape.position.distanceTo(other.position) > shapeMinProximity) {
                        shape.position.lerpVectors(shape.position, other.position, shapeReturnSpeed)
                        updateLine(shape.lines.target[i], shape.position, other.position);
                    } else if (shape.position.distanceTo(other.position) < shapeMaxProximity) {
                        let oppositeVec = other.position.clone().negate();
                        shape.position.lerpVectors(shape.position, oppositeVec, shapeReturnSpeed*2);
                        updateLine(shape.lines.target[i], shape.position, other.position);
                    }
                }
            }
        }
        // required if controls.enableDamping or controls.autoRotate are set to true
        controls.camera.update(); // must be called after any manual changes to the camera"s transform
        renderer.render(scene, camera);
    }

    // render a plane
    const planeGeometry = new THREE.PlaneGeometry(20, 20); // A 20x20 unit plane
    const planeMaterial = new THREE.MeshPhongMaterial({ color: 0x090909}); // dark gray, single-sided
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    scene.add(plane);
    plane.receiveShadow = true;
    plane.rotation.set(-Math.PI / 2, 0, 0); // Rotate to lie flat on the XZ plane
    plane.position.set(0, -1, 0);
    
    // Control shadows
    const ambientLight = new THREE.AmbientLight( 0x404040, 15 ); // soft white light
    scene.add( ambientLight );

    // render a light
    const light = new THREE.PointLight(0xffffff, 3500);
    light.position.set(-10, 20, 10);
    scene.add(light);
    light.castShadow = true;
    light.shadow.camera.top = 2;
    light.shadow.camera.bottom = - 2;
    light.shadow.camera.left = - 2;
    light.shadow.camera.right = 2;
    light.shadow.camera.near = 1;
    light.shadow.camera.far = 10;

    // load everything
    loadScene( "source/not-cube.glb")
        .then( sc => getGeometry( sc ))
        .then( geometry => {
            const cube = createShape(geometry);
            cube.position.set(0, 0, 0);
            scene.add(cube);

            const cube2 = createShape(geometry);
            cube2.position.set(3, 0, 3);
            scene.add(cube2);

            const cube3 = createShape(geometry);
            cube3.position.set(-3, 0, 3);
            scene.add(cube3);

            const line = connectLine(cube, cube2);
            scene.add(line);

            const line2 = connectLine(cube, cube3);
            scene.add(line2);

            const line3 = connectLine(cube2, cube3);
            scene.add(line3);

            // render the stuff
            renderer.setAnimationLoop(animate);
        })
}

function getHoveredShape() {
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);
    return (intersects.length > 0) ? intersects[0].object : undefined;
}

function createShape(geometry, clickable = true) {
    const material = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
    const mesh = new THREE.Mesh(geometry, material);
    shapes.push(mesh);
    console.info("Loaded mesh:", mesh);
    mesh.castShadow = true;
    mesh.clickable = clickable;
    mesh.ogPosition = new THREE.Vector3(0, 0, 0);
    mesh.lines = {
        origin: [],
        target: []
    };
    return mesh;
}

function updateLine(line, position, position2) {
    line.geometry.setFromPoints([position, position2]);
    line.geometry.attributes.position.needsUpdate = true;
}

function connectLine(shape, shape2, color = 0xc0c0c0) {
    const material = new LineMaterial( {
            color: color,
            linewidth: 2.5, 
            alphaToCoverage: true,
        });
    const geometry = new LineGeometry();
    geometry.setFromPoints([shape.position, shape2.position]);
    const line = new Line2( geometry, material );
    line.origin = shape;
    line.target = shape2;
    if (shape.lines) {
        shape.lines.origin.push(line);
    }
    if (shape2.lines) {
        shape2.lines.target.push(line);
    }
    return line;
}

function random(min, max) {
  return Math.random() * (max - min) + min;
}

async function getGeometry(scene) {
    let promise = Promise.resolve(false);
    scene.traverse(function (child) {
        if (child.isMesh) {
            console.info(`Found Geometry:`, child.geometry)
            // "child" is a THREE.Mesh object
            // "child.geometry" is the THREE.BufferGeometry associated with this mesh
            promise = Promise.resolve(child.geometry);
        }
    });
    let result = await promise;
    if (result == false) {
        console.error("Error getting geometry");
        return
    }
    return result;
}

async function loadScene(gltfPath) {
    const loader = new GLTFLoader();
    try {
        const gltf = await loader.loadAsync(gltfPath);
        // Access the loaded scene, animations, etc.
        console.info("Scene loaded successfully:", gltf.scene);
        return gltf.scene;
    } catch (error) {
        console.error("Error loading model:", error);
        throw error; // Re-throw the error for further handling
    }
}