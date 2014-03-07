/* G. Hemingway Copyright @2014
 * Manage the drawing context
 */

"use strict";


/*************************************************************************/


define(["THREE", "compass", "viewer_controls"], function(THREE, Compass, ViewerControls) {
    function Viewer(CADjs) {
        var shouldRender = false,
            continuousRendering = false,
            canvasParent, renderer, canvas, geometryScene, annotationScene, overlayScene, camera,
            controls, compass,
            render, animate, add3DObject, invalidate, zoomToFit,
            renderTargetParametersRGBA, depthTarget, depthPassPlugin,
            composer, renderPassSSAO, renderPassFXAA;

        renderTargetParametersRGBA = {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat
        };

        // RENDERER
        canvasParent = document.getElementById(CADjs._viewContainerId);
        renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true
        });
        this.renderer = renderer;
        
        renderer.setClearColor(CADjs.getThemeValue('canvasClearColor'));
        renderer.setSize(canvasParent.offsetWidth, canvasParent.offsetHeight);
        renderer.sortObjects = true;
        renderer.autoClear = false;
        // DEPTH PASS
        depthTarget = new THREE.WebGLRenderTarget(canvasParent.offsetWidth, canvasParent.offsetHeight, renderTargetParametersRGBA);
        depthPassPlugin = new THREE.DepthPassPlugin();
        depthPassPlugin.renderTarget = depthTarget;
        depthPassPlugin.enabled = false;
        renderer.addPrePlugin(depthPassPlugin);
        // CANVAS
        canvas = renderer.domElement;
        canvasParent.appendChild(canvas);
        // SCENES
        geometryScene = new THREE.Scene();
        annotationScene = new THREE.Scene();
        overlayScene = new THREE.Scene();
        // CAMERA
        camera = new THREE.PerspectiveCamera(
            75,
            canvasParent.offsetWidth / canvasParent.offsetHeight,
            0.1,
            1000000
        );
        camera.position.x = -5000;
        camera.position.y = -5000;
        camera.position.z = 0;
        camera.lookAt(geometryScene.position);

        // EFFECTS
        // EFFECT SSAO
        renderPassSSAO = new THREE.ShaderPass(THREE.SSAOShader);
        renderPassSSAO.uniforms['tDepth'].value = depthTarget;
        renderPassSSAO.uniforms['size'].value.set(canvasParent.offsetWidth, canvasParent.offsetHeight);
        renderPassSSAO.uniforms['cameraNear'].value = camera.near;
        renderPassSSAO.uniforms['cameraFar'].value = camera.far;
        renderPassSSAO.uniforms['aoClamp'].value = 0.9;
        renderPassSSAO.uniforms['lumInfluence'].value = 0.5;
        renderPassSSAO.enabled = false;
        // EFFECT FXAA
        renderPassFXAA = new THREE.ShaderPass(THREE.FXAAShader);
        renderPassFXAA.material.depthWrite = false;
        renderPassFXAA.uniforms['resolution'].value.set(1/canvasParent.offsetWidth, 1/canvasParent.offsetHeight);
        renderPassFXAA.renderToScreen = true;
        // ADD RENDER PASSES
        composer = new THREE.EffectComposer(renderer);
        composer.addPass(renderPassSSAO);
        composer.addPass(renderPassFXAA);

        // VIEW CONTROLS
        controls =  ViewerControls({
            viewer: this,
            camera: camera,
            canvas: canvas,
            renderPassSSAO: renderPassSSAO,
            renderPassFXAA: renderPassFXAA
        });

        // COMPASS
        compass = new Compass(CADjs._compassContainerId, camera, controls);

        // PRIVATE FUNCTIONS
        render = function() {
            //depthPassPlugin.enabled = true;
            renderer.render(geometryScene, camera, composer.renderTarget2, true);
            //depthPassPlugin.enabled = false;
            composer.render(0.5);
            renderer.render(overlayScene, camera);
            renderer.render(annotationScene, camera);
        };
        animate = function(forceRendering) {
            requestAnimationFrame(function() {
                animate(false);
            });
            if (continuousRendering === true || shouldRender === true || forceRendering === true) {
                shouldRender = false;
                render();
                controls.update();
                compass.update();
            }
        };
        invalidate = function() {
            shouldRender = true;
        };
        add3DObject = function(a3DObject, sceneName) {
            switch(sceneName) {
            case 'overlay':
                overlayScene.add(a3DObject);
                break;
            case 'annotation':
                annotationScene.add(a3DObject);
                break;
            case 'geometry':
            default:
                geometryScene.add(a3DObject);
                break;
            }
            invalidate();
        };
        zoomToFit = function (object) {
            var object3d = object.getObject3D(),
                boundingBox = object.getBoundingBox(),
                radius = boundingBox.size().length() * 0.5,
                horizontalFOV = 2 * Math.atan(THREE.Math.degToRad(camera.fov * 0.5) * camera.aspect),
                fov = Math.min(THREE.Math.degToRad(camera.fov), horizontalFOV),
                dist = radius / Math.sin(fov * 0.5),
                newTargetPosition = boundingBox.max.clone().
                    lerp(boundingBox.min, 0.5).
                    applyMatrix4(object3d.matrixWorld);
            camera.position.
                sub(controls.target).
                setLength(dist).
                add(newTargetPosition);
            controls.target.copy(newTargetPosition);
            invalidate();
        };

        // CONTROL EVENT HANDLERS
        controls.addEventListener("change", function() {
            invalidate();
        });
        controls.addEventListener("start", function() {
            continuousRendering = true;
        });
        controls.addEventListener("end", function() {
            invalidate();
            continuousRendering = false;
        });

        // SCREEN RESIZE
        window.addEventListener("resize", function() {
            depthTarget = new THREE.WebGLRenderTarget(canvasParent.offsetWidth, canvasParent.offsetHeight, renderTargetParametersRGBA);
            depthPassPlugin.renderTarget = depthTarget;
            renderPassSSAO.uniforms['tDepth'].value = depthTarget;
            renderPassSSAO.uniforms['size'].value.set(canvasParent.offsetWidth, canvasParent.offsetHeight);
            renderPassFXAA.uniforms['resolution'].value.set(1/canvasParent.offsetWidth, 1/canvasParent.offsetHeight);
            renderer.setSize(canvasParent.offsetWidth, canvasParent.offsetHeight);
            camera.aspect = canvasParent.offsetWidth / canvasParent.offsetHeight;
            camera.updateProjectionMatrix();
            camera.lookAt(geometryScene.position);
            composer.reset();
            controls.handleResize();
            render();
        });

        // MAKING PUBLIC
        this.camera = camera;
        this.controls = controls;
        this.invalidate = invalidate;
        this.add3DObject = add3DObject;
        this.zoomToFit = zoomToFit;
        animate(true); // Initial Rendering
    }

    // Extend Viewer with events
    THREE.EventDispatcher.prototype.apply(Viewer.prototype);
    return Viewer;
});
