import WebGL from 'three/addons/capabilities/WebGL.js';
import * as THREE from "three";
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

if ( WebGL.isWebGL2Available() ) {

  // Initiate function or other initializations here
  animate();

} else {

  const warning = WebGL.getWebGL2ErrorMessage();
  document.getElementById( 'container' ).appendChild( warning );

}

function animate() {
    // setup scene
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.z = 5;
    

    // setup rendererererer
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    // Setup external (yawn) library camera controls
    const controls = new OrbitControls( camera, renderer.domElement );

    // render a plane
    const planeGeometry = new THREE.PlaneGeometry(20, 20); // A 20x20 unit plane
    const planeMaterial = new THREE.MeshPhongMaterial({ color: 0x999999}); // Light gray, double-sided
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

    // load custom shape
    loadScene( 'source/not-cube.glb')
        .then( sc => getGeometry( sc ))
        .then( geometry => {
            console.log("Got geometry:", geometry);
            const material = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
            const cube = new THREE.Mesh(geometry, material);
            cube.castShadow = true;
            console.log("Loaded shape:", cube);
            
            function ani() {
                // cube.rotation.x += 0.01;
                cube.rotation.y += 0.01;
                // required if controls.enableDamping or controls.autoRotate are set to true
	            controls.update(); // must be called after any manual changes to the camera's transform

                renderer.render(scene, camera);
            }
            scene.add(cube);

            // render the stuff
            renderer.render(scene, camera);
            renderer.setAnimationLoop(ani);
        })
}

async function getGeometry(scene) {
    let promise;
    scene.traverse(function (child) {
        if (child.isMesh) {
            console.log(`Found Geometry:`, child.geometry)
            // 'child' is a THREE.Mesh object
            // 'child.geometry' is the THREE.BufferGeometry associated with this mesh
            promise = Promise.resolve(child.geometry);
        }
    });
    return await promise;
}

async function loadScene(gltfPath) {
    const loader = new GLTFLoader();
    try {
        const gltf = await loader.loadAsync(gltfPath);
        // Access the loaded scene, animations, etc.
        console.log('Scene loaded successfully:', gltf.scene);
        return gltf.scene;
    } catch (error) {
        console.error('Error loading model:', error);
        throw error; // Re-throw the error for further handling
    }
}