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
var scene, renderer, control, orbit, gui, texture, raycaster, Grid, specular, normal;
var meshPlane, light, helper, hemiLight, LightColorGUI, LightIntensityGUI, LightShadowGUI, LightXGUI, LightYGUI, LightZGUI, ObjColorGUI, folderLight, nameLight;
var textureLoader = new THREE.TextureLoader(),
	mouse = new THREE.Vector2();
var LightSwitch = false,
	type = null,
	pre_material = null;
var animationID;
var composer, afterimagePass, isPostProcessing = false;
var water, sun, sky;
var background_points;

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
	background_points = create_background_point();
	scene.add(background_points);

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

function create_background_point() {
	const vertices = [];
	const num_points = 30000;
	for (let i = 0; i < num_points; i++) {
		const x = THREE.MathUtils.randFloatSpread(3000);
		const y = THREE.MathUtils.randFloatSpread(3000);
		const z = THREE.MathUtils.randFloatSpread(3000);

		vertices.push(x, y, z);
	}

	const background_geometry = new THREE.BufferGeometry();
	background_geometry.setAttribute(
		"position",
		new THREE.Float32BufferAttribute(vertices, 3)
	);

	const background_material = new THREE.PointsMaterial({ color: 0xffffff });
	const background_points = new THREE.Points(
		background_geometry,
		background_material
	);
	return background_points;
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


function setMaterial(materialID) {
	type = materialID;

	// Remove current object
	pre_material != 1 ? scene.remove(mesh) : scene.remove(point);
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
			texture = loader.load('./textures/concrete.jpg', render);
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
			light.shadow.mapSize.width = 1024; // default
			light.shadow.mapSize.height = 1024; // default
			light.shadow.camera.left = -200;
			light.shadow.camera.right = 200;
			light.shadow.camera.top = 200;
			light.shadow.camera.bottom = -200;
			light.shadow.camera.near = 0.5; // default
			light.shadow.camera.far = 500; // default
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
		scene.add( helper );
		light.position.set(0, 200, 0);	
		scene.add(meshPlane);
		scene.add(light);
		
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

	window.addEventListener("keydown", function (event) {
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

var root; //vị trí gốc của đối tượng để sử dụng trong animation.
var pivots = [], //lưu trữ các pivot (trục quay) của đối tượng.
	mixer = new THREE.AnimationMixer(scene); // tạo ra với scene để xử lý các animation.
var animalLoader = new GLTFLoader(); //tải các mô hình GLTF
var type_animation = 0; // lưu trữ loại animation đang chạy.
var box = new THREE.Box3(); //để tính toán và lưu trữ hình hộp chứa đối tượng.
var clock = new THREE.Clock();
function animation(id) {
	isPostProcessing = false;
	scene.add(Grid);
	box.setFromObject(type == 1 ? point : mesh);

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

var ani1_step = 0.25;
function animation1() {
	mesh.position.y += ani1_step;
	mesh.position.z += ani1_step * 3;

	mesh.rotation.x += Math.abs(ani1_step / 10);
	mesh.rotation.y += Math.abs(ani1_step / 10);
	mesh.rotation.z += Math.abs(ani1_step / 10);

	point.rotation.copy(mesh.rotation);
	point.position.copy(mesh.position);

	let distance = Math.abs(Math.floor(mesh.position.y - root.y));

	if (distance % 10 == 0) {
	 	if (distance / 10 == 4)
	 		ani1_step *= -1;
		if (distance / 10 == 1 || distance / 10 == 2)
		ani1_step *= 1;
	}

	render();

	animationID = requestAnimationFrame(animation1);
}

var ani2_step = 0;
function animation2() {
	ani2_step += 0.05;
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
	mesh.position.x = Math.sin(performance.now() * 0.001) * 0.75;
	mesh.position.z = Math.cos(performance.now() * 0.001);

	render();
	animationID = requestAnimationFrame(animation3);
}

var rotationSpeed = 0.01; // Tốc độ xoay
var scaleSpeed = 0.01; // Tốc độ thu/phóng
var isScalingUp = true; // Cờ để xác định trạng thái thu/phóng
function animation4() {
	// Xoay đối tượng
    mesh.rotation.y += rotationSpeed;

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

    render();
    animationID = requestAnimationFrame(animation4);
}

var pathPoints = []; // Mảng chứa các điểm trên đường đi
var currentPointIndex = 0; // Chỉ số điểm hiện tại trên đường đi
var animationSpeed = 0.1; // Tốc độ di chuyển trên đường đi
function animation5() {
  // Thiết lập các điểm trên đường đi
  pathPoints.push(new THREE.Vector3(0, 0, 0)); // Điểm 0
  pathPoints.push(new THREE.Vector3(0, 0, 100)); // Điểm 1
  pathPoints.push(new THREE.Vector3(100, 0, 100)); // Điểm 2
  pathPoints.push(new THREE.Vector3(100, 0, 0)); // Điểm 3
  pathPoints.push(new THREE.Vector3(0, 0, 0)); // Điểm 4

  // Đặt vị trí ban đầu của đối tượng
  mesh.position.copy(pathPoints[0]);

  // Bắt đầu animation
  PathAnimation();
}
function PathAnimation() {
  // Di chuyển đối tượng theo đường đi
  let targetPosition = pathPoints[currentPointIndex + 1];
  mesh.position.lerp(targetPosition, animationSpeed);

  // Kiểm tra nếu đối tượng gần đến điểm tiếp theo trên đường đi
  if (mesh.position.distanceTo(targetPosition) < 0.05) {
    currentPointIndex++;

    // Kiểm tra nếu đối tượng đã đi qua toàn bộ đường đi, thì quay lại điểm đầu tiên
    if (currentPointIndex >= pathPoints.length - 1) {
      currentPointIndex = 0;
    }
  }

  render();
  animationID = requestAnimationFrame(PathAnimation);
}

var bounceHeight = 100; // Độ cao của nảy lò xo
var bounceDuration = 0.5; // Thời gian nảy lò xo (tính bằng giây)
var bounceTime = 0; // Thời gian đã trôi qua từ khi bắt đầu nảy lò xo
function animation6() {
	// Thiết lập các điểm trên đường đi
	pathPoints.push(new THREE.Vector3(0, 10, 0)); // Điểm 0
	pathPoints.push(new THREE.Vector3(30, 10, 30)); // Điểm 1
	pathPoints.push(new THREE.Vector3(4, 10, 6)); // Điểm 2
	pathPoints.push(new THREE.Vector3(2, 10, -2)); // Điểm 3
	pathPoints.push(new THREE.Vector3(0, 10, 0)); // Điểm 4
  
	// Đặt vị trí ban đầu của đối tượng
	mesh.position.copy(pathPoints[0]);
  
	animationBouncePath();
  }
function animationBouncePath() {
  
  // Di chuyển đối tượng theo đường đi
  let targetPosition = pathPoints[currentPointIndex + 1];
  mesh.position.lerp(targetPosition, 0.1);

  // Tính toán vị trí y của đối tượng dựa trên thời gian đã trôi qua và độ cao nảy lò xo
  let bounceY = Math.abs(Math.cos((bounceTime / bounceDuration) * Math.PI) * bounceHeight);

  // Đặt vị trí y của đối tượng bằng tổng của vị trí y trên đường đi và độ cao nảy lò xo
  mesh.position.y = targetPosition.y + bounceY;

  // Tăng thời gian đã trôi qua cho nảy lò xo
  bounceTime += 0.01;

  // Kiểm tra nếu đã kết thúc thời gian nảy lò xo
  if (bounceTime >= bounceDuration) {
    bounceTime = 0; // Đặt lại thời gian nảy lò xo

    currentPointIndex++;

    // Kiểm tra nếu đối tượng đã đi qua toàn bộ đường đi, thì quay lại điểm đầu tiên
    if (currentPointIndex >= pathPoints.length - 1) {
      currentPointIndex = 0;
    }
  }

  render();
  animationID = requestAnimationFrame(animationBouncePath);
}

//Models

var animalmesh;
function loadmodel(id){
	
	root = mesh.position.clone();
	scene.add(hemiLight);
	
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
			scene.remove(background_points);
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
			scene.add(background_points);
			scene.remove(water);
			scene.remove(sky);
			render();
			break;
	
	}
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
