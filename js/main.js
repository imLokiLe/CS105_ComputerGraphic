import * as THREE from "../libs/three.module.js";
import {
	OrbitControls
} from "../libs/OrbitControls.js";
import {
	TransformControls
} from "../libs/TransformControls.js";
import {
	TeapotBufferGeometry
} from "../libs/TeapotBufferGeometry.js";
import {
	GUI
} from "../libs/dat.gui.module.js";
import {
	GLTFLoader
} from '../libs/GLTFLoader.js';
import {
	EffectComposer
} from '../libs/EffectComposer.js';
import {
	RenderPass
} from '../libs/RenderPass.js';
import {
	AfterimagePass
} from '../libs/AfterimagePass.js';
import {
	Water
} from '../libs/Water.js';
import {
	Sky
} from '../libs/Sky.js';

var cameraPersp, currentCamera;
var backgroundGUI;
var typeModel;
var firstFlat = true;
var scene, renderer, control, orbit, gui, texture, raycaster, Grid, specular, normal;
var meshPlane, light, helper, hemiLight, LightColorGUI, LightIntensityGUI, LightShadowGUI, LightXGUI, LightYGUI, LightZGUI, LighthelperGUI, ObjColorGUI, folderLight, nameLight;
var textureLoader = new THREE.TextureLoader(),
	mouse = new THREE.Vector2();
var LightSwitch = false,
	type = null,
	pre_material = null;
var animationID;
var composer, afterimagePass, isPostProcessing = false;
var water, sun, sky;
var background_galaxy;

// A bunch of shapes
var BoxGeometry = new THREE.BoxGeometry(100, 100, 100, 30, 30, 30);
var SphereGeometry = new THREE.SphereGeometry(50, 50, 50);
var ConeGeometry = new THREE.ConeGeometry(50, 100, 50, 20);
var CylinderGeometry = new THREE.CylinderGeometry(50, 50, 100, 50, 20);
var TorusGeometry = new THREE.TorusGeometry(50, 20, 20, 100);
var TorusKnotGeometry = new THREE.TorusKnotGeometry(50, 15, 100, 20);
var TeapotGeometry = new TeapotBufferGeometry(50, 10);
var TetrahedronGeometry = new THREE.TetrahedronGeometry(70);
var OctahedronGeometry = new THREE.OctahedronGeometry(70);
var DodecahedronGeometry = new THREE.DodecahedronGeometry(70);
var IcosahedronGeometry = new THREE.IcosahedronGeometry(70);


// Material
var BasicMaterial = new THREE.MeshBasicMaterial({
	color: "#F5F5F5",
	side: THREE.DoubleSide,
	transparent: true
});
var PointMaterial = new THREE.PointsMaterial({
	color: "#F5F5F5",
	sizeAttenuation: false,
	size: 2,
});
var PhongMaterial = new THREE.MeshPhongMaterial({
	color: "#F5F5F5",
	side: THREE.DoubleSide,
	transparent: true
});

// Main objects on scene
var mesh = new THREE.Mesh();
var point = new THREE.Points();

// Some colors that will use
var color_000000 = new THREE.Color(0x000000);
var fog_333333 = new THREE.Fog(0x333333, 10, 1000);

//  Class for GUI control
class ColorGUIHelper {
	constructor(object, prop) {
		this.object = object;
		this.prop = prop;
	}
	get value() {
		return `#${this.object[this.prop].getHexString()}`;
	}
	set value(hexString) {
		this.object[this.prop].set(hexString);
		render();
	}
}

class MinMaxGUIHelper {
	constructor(object, minprop, maxprop) {
		this.object = object;
		this.minprop = minprop;
		this.maxprop = maxprop;
	}
	get min() {
		return this.object[this.minprop];
	}
	set min(v) {
		this.object[this.minprop] = v;
	}
	get max() {
		return this.object[this.maxprop];
	}
	set max(v) {
		this.object[this.maxprop] = v;
	}
}

init();
render();

function init() {
	// Scene

	scene = new THREE.Scene();
	scene.background = color_000000;
	background_galaxy = Particle_Star_Field();
	scene.add(background_galaxy);

	// Grid
	const planeSize = 2000;
	Grid = new THREE.GridHelper(planeSize, 100, '#ffffff', '#ffffff');
	scene.add(Grid);

	// Coordinate axes
	// const Axes = new THREE.AxesHelper(30);
	// scene.add(Axes);

	// Fog
	scene.fog = fog_333333;

	// GUI control
	{
		gui = new GUI({
			autoPlace: false
		});
		let customContainer = document.getElementById("my-gui-container");
		customContainer.appendChild(gui.domElement);
	}

	//Background
	backgroundGUI = gui.addColor(new ColorGUIHelper(scene, "background"), "value").name("Background");

	// Camera
	{
		const fov = 75;
		const aspectRatio = window.innerWidth / window.innerHeight;
		const near = 1;
		const far = 2000;
		cameraPersp = new THREE.PerspectiveCamera(fov, aspectRatio, near, far);
		currentCamera = cameraPersp;
		currentCamera.position.set(50, 150, 450);
		currentCamera.lookAt(0, 0, 0);

		const folderCam = gui.addFolder("Camera");
		folderCam.open();
		folderCam.add(currentCamera, "fov", 1, 180).name("FOV").onChange(updateCamera);
		const minMaxGUIHelper = new MinMaxGUIHelper(currentCamera, "near", "far");
		folderCam.add(minMaxGUIHelper, "min", 1, 500, 1).name("Near").onChange(updateCamera);
		folderCam.add(minMaxGUIHelper, "max", 100, 6000, 10).name("Far").onChange(updateCamera);
		folderCam.add(currentCamera.position, "x", -1000, 1000).name("Camera X").onChange(updateCamera);
		folderCam.add(currentCamera.position, "y", -1000, 1000).name("Camera Y").onChange(updateCamera);
		folderCam.add(currentCamera.position, "z", -1000, 1000).name("Camera Z").onChange(updateCamera);
	}

	ObjColorGUI = gui.addColor(new ColorGUIHelper(mesh.material, "color"), "value").name("Object Color");
	raycaster = new THREE.Raycaster();

	// Render
	{
		renderer = new THREE.WebGLRenderer({
			antialias: true,
			logarithmicDepthBuffer: true
		});
		renderer.setPixelRatio(window.devicePixelRatio);
		renderer.setSize(window.innerWidth, window.innerHeight);
		renderer.shadowMap.enabled = true;
		renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		document.getElementById("rendering").appendChild(renderer.domElement);
	}

	// Check when the browser size has changed and adjust the camera accordingly
	window.addEventListener("resize", function () {
		const WIDTH = window.innerWidth;
		const HEIGHT = window.innerHeight;

		currentCamera.aspect = WIDTH / HEIGHT;
		currentCamera.updateProjectionMatrix();

		renderer.setSize(WIDTH, HEIGHT);
		composer.setSize(WIDTH, HEIGHT);

		render();
	});

	{
		orbit = new OrbitControls(currentCamera, renderer.domElement);
		orbit.update();
		orbit.addEventListener("change", render);

		control = new TransformControls(currentCamera, renderer.domElement);
		control.addEventListener("change", render);

		control.addEventListener("dragging-changed", function (event) {
			orbit.enabled = !event.value;
		});
	}

	// Init plane for showing shadow
	const planeGeo = new THREE.PlaneGeometry(planeSize, planeSize);
	const planeMat = new THREE.MeshPhongMaterial({
		side: THREE.DoubleSide,
	});

	{
		meshPlane = new THREE.Mesh(planeGeo, planeMat);
		meshPlane.receiveShadow = true;
		meshPlane.rotation.x = -Math.PI / 2;
	}

	//Light
	light = new THREE.AmbientLight("#F5F5F5", 0.5);
	scene.add(light);
	folderLight = gui.addFolder("Light")

	// Post processing
	{
		composer = new EffectComposer(renderer);
		composer.addPass(new RenderPass(scene, currentCamera));

		afterimagePass = new AfterimagePass();
		afterimagePass.uniforms["damp"].value = 0.96;
		composer.addPass(afterimagePass);
	}

	// Sun
	sun = new THREE.Vector3();

	// Water
	{
		water = new Water(
			planeGeo, {
				textureWidth: 512,
				textureHeight: 512,
				waterNormals: new THREE.TextureLoader().load('../textures/waternormals.jpg', function (texture) {
					texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
				}),
				alpha: 1.0,
				sunDirection: new THREE.Vector3(),
				sunColor: 0xffffff,
				waterColor: 0x001e0f,
				distortionScale: 3.7,
				fog: scene.fog !== undefined
			}
		);

		water.rotation.x = -Math.PI / 2;
	}

	// Skybox
	{
		sky = new Sky();
		sky.scale.setScalar(planeSize);
		sky.name = "Sky";
		var uniforms = sky.material.uniforms;
		uniforms['turbidity'].value = 10;
		uniforms['rayleigh'].value = 2;
		uniforms['mieCoefficient'].value = 0.005;
		uniforms['mieDirectionalG'].value = 0.8;
	}

	// Sky light
	{
		hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.5);
		hemiLight.color.setHSL(0.6, 1, 0.6);
		hemiLight.groundColor.setHSL(0.095, 1, 0.75);
		hemiLight.position.set(0, 50, 0);
	}
}

function Particle_Star_Field() {
	var geometry = new THREE.Geometry();
	var totalObjects = 30000;

	for (let i = 0; i < totalObjects; i ++) 
	{ 
	var vertex = new THREE.Vector3();
	vertex.x = THREE.MathUtils.randFloatSpread(4500);
	vertex.y = THREE.MathUtils.randFloatSpread(4500);
	vertex.z = THREE.MathUtils.randFloatSpread(4500);
	geometry.vertices.push( vertex );
	}

	var material = new THREE.ParticleBasicMaterial( { size: 2 });
	var particles = new THREE.ParticleSystem( geometry, material );
		
	return particles;
}

function render() {
	renderer.clear();
	if (isPostProcessing){
		// render differently for the effect after image
		composer.render()
	}
	else{
		renderer.render(scene, currentCamera);
	}
}

function addMesh(meshID) {
	switch (meshID) {
		case 1:
			mesh.geometry = BoxGeometry;
			mesh.position.set(0, 70, 0);
			break;
		case 2:
			mesh.geometry = SphereGeometry;
			mesh.position.set(0, 70, 0);
			break;
		case 3:
			mesh.geometry = ConeGeometry;
			mesh.position.set(0, 70, 0);
			break;
		case 4:
			mesh.geometry = CylinderGeometry;
			mesh.position.set(0, 70, 0);
			break;
		case 5:
			mesh.geometry = TorusGeometry;
			mesh.position.set(0, 90, 0);
			break;
		case 6:
			mesh.geometry = TorusKnotGeometry;
			mesh.position.set(0, 90, 0);
			break;
		case 7:
			mesh.geometry = TeapotGeometry;
			mesh.position.set(0, 70, 0);
			break;
		case 8:
			mesh.geometry = TetrahedronGeometry;
			mesh.position.set(0, 70, 0);
			break;
		case 9:
			mesh.geometry = OctahedronGeometry;
			mesh.position.set(0, 70, 0);
			break;
		case 10:
			mesh.geometry = DodecahedronGeometry;
			mesh.position.set(0, 70, 0);
			break;
		case 11:
			mesh.geometry = IcosahedronGeometry;
			mesh.position.set(0, 70, 0);
			break;
		default:
			break;
	}

	point.geometry = mesh.geometry;
	setMaterial(3)
	
	mesh.rotation.set(0, 0, 0);
	mesh.scale.set(1, 1, 1);

	render();
}
window.addMesh = addMesh;

function removeGeometry(){
	pre_material != 1 ? scene.remove(mesh) : scene.remove(point);
	gui.remove(ObjColorGUI);

	if (control.object && (control.object.type == "Mesh" || control.object.type == "Points"))
		control.detach();
	pre_material = null;
	type = null;
	render();
}
window.removeGeometry = removeGeometry;

function setMaterial(materialID) {
	type = materialID;

	// Remove current object
	pre_material != 1 ? scene.remove(mesh) : scene.remove(point);
	if (firstFlat){
		gui.remove(ObjColorGUI);
		firstFlat = false;
	}
	if(pre_material != null) 
		gui.remove(ObjColorGUI);

	if (control.object && (control.object.type == "Mesh" || control.object.type == "Points"))
		control.detach();

	switch (materialID) {
		case 1:
			point.material = PointMaterial;
			break;
		case 2:
			mesh.material = BasicMaterial;
			mesh.material.wireframe = true;
			break;
		case 3:
			if (!LightSwitch)
				mesh.material = BasicMaterial;
			else
				mesh.material = PhongMaterial;
			mesh.material.wireframe = false;
			break;
		case 4:
			if (!LightSwitch)
				mesh.material = BasicMaterial;
			else
				mesh.material = PhongMaterial;
			mesh.material.wireframe = false;
			mesh.material.map = texture;
			mesh.material.map.needsUpdate = true;
			mesh.material.needsUpdate = true;
			break;
		case 5:
			if (!LightSwitch)
				mesh.material = BasicMaterial;
			else
				mesh.material = PhongMaterial;
			mesh.material.wireframe = false;
			mesh.material.map = texture;
			mesh.material.specularMap = specular;
			mesh.material.normalMap = normal;
			mesh.material.map.needsUpdate = true;
			mesh.material.needsUpdate = true;
			break;
		default:
			break;
	}

	mesh.castShadow = true;

	if (materialID != 4) {
		mesh.material.map = null;
		mesh.material.needsUpdate = true;
	}

	if (pre_material != 1 && materialID == 1) {
		point.position.copy(mesh.position);
		point.rotation.copy(mesh.rotation);
		point.scale.copy(mesh.scale);
	}

	if (pre_material == 1 && materialID != 1) {
		mesh.position.copy(point.position);
		mesh.rotation.copy(point.rotation);
		mesh.scale.copy(point.scale);
	}

	if (materialID == 2 || materialID == 3) {
		mesh.material.color.set("#F5F5F5");
		ObjColorGUI = gui.addColor(new ColorGUIHelper(mesh.material, "color"), "value").name("Object Color");
		scene.add(mesh);
	} 
	if(materialID == 1) {
		point.material.color.set("#F5F5F5");
		ObjColorGUI = gui.addColor(new ColorGUIHelper(point.material, "color"), "value").name("Object Color");
		scene.add(point);
	}
	if (materialID == 4 || materialID == 5){
		ObjColorGUI = gui.addColor(new ColorGUIHelper(mesh.material, "color"), "value").name("Object Color");
		scene.add(mesh);
	}

	pre_material = materialID;
	render();
}
window.setMaterial = setMaterial;

function setTexture(url) {
	texture = textureLoader.load(url, render);
	texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
	setMaterial(4);
}
window.setTexture = setTexture;

function setInstantTexture(TextureID){
	var loader = new THREE.TextureLoader();
	switch(TextureID){
		case 1:
			texture = loader.load('./textures/brick.jpg', render);
			break;
		case 2:
			texture = loader.load('./textures/Wood.jpg', render);
			break;
		case 3:
			texture = loader.load('./textures/earth_atmos_2048.jpg', render);
			specular = loader.load('./textures/earth_specular_2048.jpg', render);
			normal = loader.load('./textures/earth_normal_2048.jpg', render);
			break;
	}
	texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
	setMaterial(4);
	render();
}
window.setInstantTexture = setInstantTexture;

function removeLight(){
	if (LightSwitch){
		folderLight.remove(LightColorGUI);
		folderLight.remove(LightIntensityGUI);
		folderLight.remove(LightShadowGUI);
		folderLight.remove(LightXGUI);
		folderLight.remove(LightYGUI);
		folderLight.remove(LightZGUI);
		folderLight.remove(nameLight);
	}
	scene.remove(helper);
	scene.remove(light);
}

function setLight(LightID) {
	if (LightSwitch){
		removeLight();
	}
	let intensity = 1;
	let shadow = true;
	switch (LightID) {
		case 1:	
			light = new THREE.PointLight("#F5F5F5", intensity, Infinity);
			light.castShadow = shadow;
			nameLight = folderLight.add({ title: 'Point Light' }, 'title').name('');
			helper = new THREE.PointLightHelper(light, 10);
			LightSwitch = true;
			break;
		case 2:
			light = new THREE.DirectionalLight("#F5F5F5", intensity);
			light.castShadow = shadow;
			light.shadow.mapSize.width = 2048; 
			light.shadow.mapSize.height = 2048; 
			light.shadow.camera.left = -200;
			light.shadow.camera.right = 200;
			light.shadow.camera.top = 200;
			light.shadow.camera.bottom = -200;
			light.shadow.camera.near = 0.5; 
			light.shadow.camera.far = 500; 
			nameLight = folderLight.add({ title: 'Directional Light' }, 'title').name('');
			helper = new THREE.DirectionalLightHelper(light, 10);
			LightSwitch = true;
			break;
		case 3:				//Spot Light
			light = new THREE.SpotLight("#F5F5F5", intensity);
			light.castShadow = shadow;
			nameLight = folderLight.add({ title: 'Spot Light' }, 'title').name('');
			helper = new THREE.SpotLightHelper(light);
			LightSwitch = true;
			break;
		case 4:
			LightSwitch = false;
			if (type == 3 || type == 4 || type == 5)
				setMaterial(type);
			break;
	}

	if(LightSwitch){
		// helper = new THREE.CameraHelper( light.shadow.camera );
		light.position.set(0, 200, 0);	
		scene.add( helper );
		scene.add(meshPlane);
		scene.add(light);
		render();
		
		if (type == 3 || type == 4)
			setMaterial(type);

		folderLight.open()
		LightColorGUI = folderLight.addColor(new ColorGUIHelper(light, "color"), "value").name("Color");
		LightIntensityGUI = folderLight.add(light,'intensity',0,10).name("Intensity").listen().onChange(() =>{
			render();
		});
		LightShadowGUI = folderLight.add(light, 'castShadow', false).name("Shadow").listen().onChange(() =>{
			render();
		});
		LightXGUI = folderLight.add(light.position, 'x', -500, 500).name("posX").listen().onChange(() =>{
			render();
		});
		LightYGUI = folderLight.add(light.position, 'y', -500, 500).name("posY").listen().onChange(() =>{
			render();
		});
		LightZGUI = folderLight.add(light.position, 'z', -500, 500).name("posZ").listen().onChange(() =>{
			render();
		})
	}
	render();
}
window.setLight = setLight;


function setControlTransform(mesh) {
    control.attach(mesh);
    scene.add(control);
	
	var keyStates = {};

	window.addEventListener("keydown", function(event) {
		keyStates[event.keyCode] = true;

		switch (event.keyCode) {
			case 84: // T
				eventTranslate();
				break;
			case 82: // R
				eventRotate();
				break;
			case 83: // S
				eventScale();
				break;
		}
	});

	window.addEventListener("keyup", function(event) {
		keyStates[event.keyCode] = false;
	});

    function update() {
        if (control.mode === "translate") {
            var speed = 1;

            if (keyStates[88]) { // X
                if (keyStates[16]) { // Shift
					mesh.position.x += speed; 
				} else {
					mesh.position.x -= speed; 
				}
            }
            if (keyStates[89]) { // Y
				if (keyStates[16]) { // Shift
					mesh.position.y += speed;
				} else {
					mesh.position.y -= speed;
				}
            }
            if (keyStates[90]) { // Z
                if (keyStates[16]) { // Shift
					mesh.position.z += speed;
				} else {
					mesh.position.z -= speed;
				}
            }
            if (keyStates[88] && keyStates[89] && keyStates[90]) { // XYZ
                if (keyStates[16]) { // Shift
					mesh.position.x += speed; 
					mesh.position.y += speed;
					mesh.position.z += speed;
				} else {
					mesh.position.x -= speed; 
					mesh.position.y -= speed;
					mesh.position.z -= speed;
				}
            }
        }

		if (control.mode === "rotate") {
			var speed = Math.PI / 180; // Tốc độ xoay (đơn vị radian)
		
			if (keyStates[88]) { // X
			  if (keyStates[16]) { // Shift
				mesh.rotation.x -= speed; // Xoay ngược chiều kim đồng hồ
			  } else {
				mesh.rotation.x += speed; // Xoay theo chiều kim đồng hồ
			  }
			}
			if (keyStates[89]) { // Y
				if (keyStates[16]) { // Shift
				  mesh.rotation.y -= speed; // Xoay ngược chiều kim đồng hồ
				} else {
				  mesh.rotation.y += speed; // Xoay theo chiều kim đồng hồ
				}
			}
			if (keyStates[90]) { // Z
				if (keyStates[16]) { // Shift
				  mesh.rotation.z -= speed; // Xoay ngược chiều kim đồng hồ
				} else {
				  mesh.rotation.z += speed; // Xoay theo chiều kim đồng hồ
				}
			}
			if (keyStates[88] && keyStates[89] && keyStates[90]) { // XYZ
                if (keyStates[16]) { // Shift
					mesh.rotation.x -= speed;
					mesh.rotation.y -= speed;
					mesh.rotation.z -= speed;
				} else {
					mesh.rotation.x += speed;
					mesh.rotation.y += speed;
					mesh.rotation.z += speed;
				}
            }
		  }
		
		if (control.mode === "scale") {
			var speed = 0.01; // Hệ số tỷ lệ
		
			if (keyStates[88]) { // X
				if (keyStates[16]) { // Shift
				mesh.scale.x -= speed; // Giảm tỷ lệ theo trục X
				} else {
				mesh.scale.x += speed; // Tăng tỷ lệ theo trục X
				}
			}
			if (keyStates[89]) { // Y
				if (keyStates[16]) { // Shift
				mesh.scale.y -= speed; // Giảm tỷ lệ theo trục Y
				} else {
				mesh.scale.y += speed; // Tăng tỷ lệ theo trục Y
				}
			}
			if (keyStates[90]) { // Z
				if (keyStates[16]) { // Shift
				mesh.scale.z -= speed; // Giảm tỷ lệ theo trục Z
				} else {
				mesh.scale.z += speed; // Tăng tỷ lệ theo trục Z
				}
			}
			if (keyStates[88] && keyStates[89] && keyStates[90]) { // XYZ
				if (keyStates[16]) { // Shift
				mesh.scale.x -= speed; 
				mesh.scale.y -= speed; 
				mesh.scale.z -= speed; 
				} else {
				mesh.scale.x += speed; 
				mesh.scale.y += speed; 
				mesh.scale.z += speed; 
				}
			}
		}

		render();
    }

    function AnimateTransform() {
        requestAnimationFrame(AnimateTransform);
        update();
    }

    AnimateTransform();
}

function eventTranslate() {
	control.setMode("translate");
}
window.eventTranslate = eventTranslate;

function eventRotate() {
	control.setMode("rotate");
}
window.eventRotate = eventRotate;

function eventScale() {
	control.setMode("scale");
}
window.eventScale = eventScale;  


document.getElementById("rendering").addEventListener("mousedown", onDocumentMouseDown, false);

function onDocumentMouseDown(event) {
	event.preventDefault();
	mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
	mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

	// Find intersections
	raycaster.setFromCamera(mouse, currentCamera);
	let intersects = raycaster.intersectObjects(scene.children);
	let check_obj = 0;

	if (intersects.length > 0) {
		let obj;
		for (obj in intersects) {
			if (intersects[obj].object.geometry.type == "PlaneGeometry") continue;
			if (intersects[obj].object.name == "Sky") continue;
			if (intersects[obj].object.type == "Mesh" || intersects[obj].object.type == "Points") {
				check_obj = 1;
				setControlTransform(intersects[obj].object);
				break;
			}
		}
	}

	if (check_obj == 0 && control.dragging == 0)
		control.detach();
	render();
}

//Animation 
var root; //vị trí gốc của đối tượng để sử dụng trong animation.
var type_animation = 0; // lưu trữ loại animation đang chạy.
var box = new THREE.Box3(); //để tính toán và lưu trữ hình hộp chứa đối tượng.
function animation(id) {
	isPostProcessing = false;
	scene.add(Grid);
	box.setFromObject(mesh);

	type_animation = id;

	if (type == null)
		return;

	root = mesh.position.clone(); // Sao chép vị trí của mesh vào biến root để sử dụng trong các frame animation.
	cancelAnimationFrame(animationID); //Hủy bỏ frame animation hiện tại nếu có.

	switch (id) {
		case 1:
			animation1();
			break;
		case 2:
			isPostProcessing = true;
			animation2();
			break;
		case 3:
			animation3(); 
			break;
		case 4:
			isPostProcessing = true;
			animation4();
			break;
		case 5:
			animation5();
			break;
		case 6:
			animation6();
			break;
	}

	render();
}
window.animation = animation;

var radius = Math.floor(Math.random() * (700 - 100 + 1)) + 3; // Bán kính của quỹ đạo tròn
var speed = 0.01; // Tốc độ di chuyển
var angle = 0; // Góc xoay hiện tại
function animation1() {
	// Tính toán vị trí mới dựa trên góc xoay hiện tại và bán kính
	var x = radius * Math.cos(angle);
	var z = radius * Math.sin(angle);
	let y = root.y
  
	// Đặt vị trí của đối tượng
	mesh.position.set(x, y, z);
	point.position.copy(mesh.position);

  
	// Tăng góc xoay để di chuyển đối tượng trên quỹ đạo tròn
	angle += speed;
  
	// Kiểm tra nếu đã quay một vòng đủ, đặt lại góc xoay về 0
	if (angle >= 2 * Math.PI) {
	  angle = 0;
	}
	mesh.rotation.x += 0.03;
	mesh.rotation.y += 0.03;
	point.rotation.copy(mesh.rotation);

	render();

	animationID = requestAnimationFrame(animation1);
}


var ani2_step = 0;
function animation2() {
	ani2_step += 0.05
	let width = box.max.x - box.min.x;
	mesh.position.x = width * Math.cos(ani2_step) + root.x;
	mesh.position.y = width * Math.sin(ani2_step) + root.y;
	point.position.copy(mesh.position);

	mesh.rotation.x += 0.03;
	mesh.rotation.y += 0.03;
	point.rotation.copy(mesh.rotation);
	
	render();
	animationID = requestAnimationFrame(animation2);
}

function animation3() {
	mesh.rotation.x = performance.now() * 0.001;
	mesh.rotation.y = performance.now() * 0.001;
	mesh.rotation.z = performance.now() * 0.001;
	point.rotation.copy(mesh.rotation);

	render();
	animationID = requestAnimationFrame(animation3);
}

var rotationSpeed = 0.01; // Tốc độ xoay
var scaleSpeed = 0.01; // Tốc độ thu/phóng
var isScalingUp = true; // Cờ để xác định trạng thái thu/phóng
function animation4() {
	// Xoay đối tượng
    mesh.rotation.y += rotationSpeed;
	point.rotation.copy(mesh.rotation);

    // Thu/phóng đối tượng
    if (isScalingUp) {
        mesh.scale.x += scaleSpeed;
        mesh.scale.y += scaleSpeed;
        mesh.scale.z += scaleSpeed;
    } else {
        mesh.scale.x -= scaleSpeed;
        mesh.scale.y -= scaleSpeed;
        mesh.scale.z -= scaleSpeed;
    }

    // Kiểm tra nếu đối tượng đạt tới giới hạn thu/phóng thì đảo chiều
    if (mesh.scale.x >= 2 || mesh.scale.x <= 0.5) {
        isScalingUp = !isScalingUp;
    }
	point.scale.copy(mesh.scale);

    render();
    animationID = requestAnimationFrame(animation4);
}

let morphTime = 0; // Biến thời gian hiệu ứng morphing
const morphDuration = 1; // Thời gian hiệu ứng morphing (tính bằng giây)
function morphingMesh(meshID) {
	switch (meshID) {
		case 1:
			mesh.geometry = BoxGeometry;
			break;
		case 2:
			mesh.geometry = SphereGeometry;
			break;
		case 3:
			mesh.geometry = ConeGeometry;
			break;
		case 4:
			mesh.geometry = CylinderGeometry;
			break;
		case 5:
			mesh.geometry = TorusGeometry;
			break;
		case 6:
			mesh.geometry = TorusKnotGeometry;
			break;
		case 7:
			mesh.geometry = TeapotGeometry;
			break;
		case 8:
			mesh.geometry = TetrahedronGeometry;
			break;
		case 9:
			mesh.geometry = OctahedronGeometry;
			break;
		case 10:
			mesh.geometry = DodecahedronGeometry;
			break;
		case 11:
			mesh.geometry = IcosahedronGeometry;
			break;
		default:
			break;
	}
	point.geometry = mesh.geometry;
	render();
}
function animation5() {
	mesh.rotation.x += 0.03;
	mesh.rotation.y += 0.03;
	mesh.rotation.z += 0.03;
	point.rotation.copy(mesh.rotation);

	morphTime += 0.01; // Tăng giá trị morphTime

	if (morphTime >= morphDuration) {
		morphTime = 0; // Đặt lại morphTime về 0
		var currentGeometryIndex = Math.floor(Math.random() * (11 - 1 + 1)) + 1;
		morphingMesh(currentGeometryIndex)
		var currentMaterialIndex = Math.floor(Math.random() * (3 - 1 + 1)) + 1;
		setMaterial(currentMaterialIndex)
	}
	render();
	animationID = requestAnimationFrame(animation5);
}

var pathPoints = []; // Mảng chứa các điểm trên đường đi
var currentPointIndex = 0; // Chỉ số điểm hiện tại trên đường đi
var bounceHeight = 100; // Độ cao của nảy lò xo
var bounceDuration = 0.5; // Thời gian nảy lò xo (tính bằng giây)
var bounceTime = 0; // Thời gian đã trôi qua từ khi bắt đầu nảy lò xo
var bounceInterval = 0.01; // Khoảng thời gian giữa mỗi khung hình
function generateRandomPath() {
	pathPoints = []
    var numPoints = Math.floor(Math.random() * (20 - 3 + 1)) + 3; // Số lượng điểm trên đường đi
    var maxX = 500; // Giới hạn tọa độ x tối đa
    var maxZ = 500; // Giới hạn tọa độ z tối đa

    for (var i = 0; i < numPoints; i++) {
        var x = Math.random() * (maxX * 2) - maxX;
        var y = root.y;
        var z = Math.random() * (maxZ * 2) - maxZ;

        pathPoints.push(new THREE.Vector3(x, y, z));
    }

    // Thêm điểm cuối trùng với điểm đầu để tạo vòng lặp
    pathPoints.push(pathPoints[0]);
}
function animation6() {
	generateRandomPath()
	animationBouncePath();
}
function animationBouncePath() {
	// Lấy vị trí hiện tại và vị trí tiếp theo trên đường đi
	let currentPosition = pathPoints[currentPointIndex];
	let nextPosition = pathPoints[currentPointIndex + 1];

	// Tính toán tỉ lệ hoàn thành nảy lò xo
	var progress = bounceTime / bounceDuration;

	// Tính toán vị trí y của đối tượng dựa trên thời gian đã trôi qua và độ cao nảy lò xo
	var bounceY = Math.abs(Math.cos(progress * Math.PI) * bounceHeight);

	// Tính toán vị trí lerp (linear interpolation) trên trục x và z
	var lerpedX = THREE.MathUtils.lerp(currentPosition.x, nextPosition.x, progress);
	var lerpedZ = THREE.MathUtils.lerp(currentPosition.z, nextPosition.z, progress);

	// Đặt vị trí của đối tượng
	mesh.position.x = lerpedX;
	mesh.position.y = currentPosition.y + bounceY;
	mesh.position.z = lerpedZ;

	// Tăng thời gian đã trôi qua cho nảy lò xo
	bounceTime += bounceInterval;

	// Kiểm tra nếu đã kết thúc thời gian nảy lò xo
	if (bounceTime >= bounceDuration) {
		bounceTime = 0; // Đặt lại thời gian nảy lò xo

		currentPointIndex++;

		// Kiểm tra nếu đối tượng đã đi qua toàn bộ đường đi, thì quay lại điểm đầu tiên
		if (currentPointIndex >= pathPoints.length - 1) {
			currentPointIndex = 0;
		}
	}
	point.position.copy(mesh.position);

	mesh.rotation.x = performance.now() * 0.001;
	mesh.rotation.y = performance.now() * 0.001;
	mesh.rotation.z = performance.now() * 0.001;
	point.rotation.copy(mesh.rotation);

	render();
	animationID = requestAnimationFrame(animationBouncePath);
}

//Models

var pivots = []; //lưu trữ các pivot (trục quay) của đối tượng.
var animalLoader = new GLTFLoader(); //tải các mô hình GLTF
var animalmesh;
var animalmesh;
function loadmodel(id){
	
	root = mesh.position.clone();
	if(pre_material != null){
		removeGeometry();
	}
	scene.add(hemiLight);
	if(typeModel == 3){
		scene.remove(water);
		scene.remove(sky);
		scene.add(Grid);
		scene.add(background_galaxy);
	}
	
	let pivot = new THREE.Group();
	
	switch (id)
	{
		case 1:
			for (let i = 0; i < pivots.length; ++i)
				scene.remove(pivots[i]);
			pivots = [];
			animalLoader.load('models/sateline/scene.gltf', (gltfScene) => {
				animalmesh = gltfScene.scene;
				gltfScene.scene.rotation.y = Math.PI / 3;
				gltfScene.scene.position.set(0, 150, 0);
				gltfScene.scene.scale.set(0.5, 0.5, 0.5);
	
				pivot.position.set(root.x, 0, root.z);
				scene.add(pivot);
				pivot.add(animalmesh);
				pivots.push(pivot);
				render();
			}
			);
			break;
		case 2:
			for (let i = 0; i < pivots.length; ++i)
				scene.remove(pivots[i]);
			pivots = [];
			animalLoader.load('models/plane/scene.gltf', (gltfScene) => {
				animalmesh = gltfScene.scene;
				gltfScene.scene.rotation.y = -Math.PI / 2;
				gltfScene.scene.position.set(0, 5, 0);
				gltfScene.scene.scale.set(0.5, 0.5, 0.5);
				// scene.add(animalmesh);
				pivot.position.set(root.x, 0, root.z);
				scene.add(pivot);
				pivot.add(animalmesh);
				pivots.push(pivot);
				render()
			}
			);
			
			break;
		case 3:
			scene.remove(Grid);
			scene.remove(background_galaxy);
			scene.add(water);
			scene.add(sky);
			updateSun();
			for (let i = 0; i < pivots.length; ++i)
				scene.remove(pivots[i]);
			pivots = [];
			animalLoader.load('models/plushie_shark/scene.gltf', (gltfScene) => {
				animalmesh = gltfScene.scene;
				gltfScene.scene.rotation.y = Math.PI / 8;
				gltfScene.scene.position.set(0, 20, 0);
				gltfScene.scene.scale.set(200, 200, 200);
				// scene.add(animalmesh);
				pivot.position.set(root.x, 0, root.z);
				scene.add(pivot);
				pivot.add(animalmesh);
				pivots.push(pivot);
				render();
			}
			);
			const animate = () => {
				if (animalmesh) {
					animalmesh.rotation.x += 0.01;
					animalmesh.rotation.y += 0.01;
					animalmesh.rotation.z += 0.01;
				}
				requestAnimationFrame(animate);
				render();
			  };
			animate();
			  
			break;
			
		case 4:
			for (let i = 0; i < pivots.length; ++i)
				scene.remove(pivots[i]);
			pivots = [];
			scene.add(Grid);
			scene.add(background_galaxy);
			scene.remove(water);
			scene.remove(sky);
			render();
			break;
	
	}
	typeModel = id;
}

window.loadmodel = loadmodel;


function updateCamera() {
	currentCamera.updateProjectionMatrix();
	render();
}


function updateSun() {
	let pmremGenerator = new THREE.PMREMGenerator(renderer);
	let inclination = 0.49;
	let azimuth = 0.205;

	let theta = Math.PI * (inclination - 0.5);
	let phi = 2 * Math.PI * (azimuth - 0.5);

	sun.x = Math.cos(phi);
	sun.y = Math.sin(phi) * Math.sin(theta);
	sun.z = Math.sin(phi) * Math.cos(theta);

	sky.material.uniforms['sunPosition'].value.copy(sun);
	water.material.uniforms['sunDirection'].value.copy(sun).normalize();

	scene.environment = pmremGenerator.fromScene(sky).texture;
}
