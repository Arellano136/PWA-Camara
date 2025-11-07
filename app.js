// Inicialización de PouchDB
const db = new PouchDB('camera_photos');

// Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => console.log('✓ Service Worker registrado:', registration))
            .catch(err => console.error('✗ Error al registrar Service Worker:', err));
    });
}

// Referencias DOM
const openCameraBtn = document.getElementById('openCamera');
const cameraContainer = document.getElementById('cameraContainer');
const video = document.getElementById('video');
const takePhotoBtn = document.getElementById('takePhoto');
const switchCameraBtn = document.getElementById('switchCamera');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const gallery = document.getElementById('gallery');
const clearGalleryBtn = document.getElementById('clearGallery');

let stream = null;
let currentFacingMode = 'environment'; // 'environment' = trasera, 'user' = frontal

// Abrir cámara
async function openCamera() {
    try {
        const constraints = {
            video: {
                facingMode: { ideal: currentFacingMode },
                width: { ideal: 640 },
                height: { ideal: 480 }
            }
        };

        stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;

        cameraContainer.style.display = 'block';
        openCameraBtn.textContent = '✅ Cámara Abierta';
        openCameraBtn.disabled = true;

        console.log('Cámara abierta exitosamente');
    } catch (error) {
        console.error('Error al acceder a la cámara:', error);
        alert('No se pudo acceder a la cámara. Asegúrate de dar permisos.');
    }
}

// Cambiar entre cámara frontal y trasera
async function switchCamera() {
    currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';

    if (stream) {
        closeCamera();
        await openCamera();
    }
}

// Tomar foto
async function takePhoto() {
    if (!stream) {
        alert('Primero debes abrir la cámara');
        return;
    }

    // Dibujar frame actual en canvas
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convertir a base64
    const imageDataURL = canvas.toDataURL('image/png');

    console.log('Foto capturada:', imageDataURL.length, 'caracteres');

    // Guardar en PouchDB
    await savePhoto(imageDataURL);

    // Actualizar galería
    await loadGallery();
}

// Guardar foto en PouchDB
async function savePhoto(imageDataURL) {
    try {
        const doc = {
            _id: new Date().toISOString(),
            type: 'photo',
            image: imageDataURL,
            timestamp: Date.now()
        };

        await db.put(doc);
        console.log('✓ Foto guardada en PouchDB');
    } catch (error) {
        console.error('✗ Error al guardar foto:', error);
    }
}

// Cargar galería desde PouchDB
async function loadGallery() {
    try {
        const result = await db.allDocs({
            include_docs: true,
            descending: true
        });

        gallery.innerHTML = '';

        if (result.rows.length === 0) {
            gallery.innerHTML = '<p class="gallery-empty">No hay fotos capturadas aún</p>';
            return;
        }

        result.rows.forEach(row => {
            const doc = row.doc;
            if (doc.type === 'photo') {
                const item = document.createElement('div');
                item.className = 'gallery-item';

                const img = document.createElement('img');
                img.src = doc.image;
                img.alt = 'Foto capturada';

                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'delete-photo-btn';
                deleteBtn.innerHTML = '×';
                deleteBtn.onclick = () => deletePhoto(doc._id, doc._rev);

                item.appendChild(img);
                item.appendChild(deleteBtn);
                gallery.appendChild(item);
            }
        });

        // Scroll al final para ver la última foto
        gallery.scrollLeft = gallery.scrollWidth;
    } catch (error) {
        console.error('Error al cargar galería:', error);
    }
}

// Eliminar foto individual
async function deletePhoto(id, rev) {
    try {
        await db.remove(id, rev);
        console.log('✓ Foto eliminada');
        await loadGallery();
    } catch (error) {
        console.error('✗ Error al eliminar foto:', error);
    }
}

// Limpiar toda la galería
async function clearGallery() {
    if (!confirm('¿Estás seguro de que deseas eliminar todas las fotos?')) {
        return;
    }

    try {
        const result = await db.allDocs();
        const docs = result.rows.map(row => ({
            _id: row.id,
            _rev: row.value.rev,
            _deleted: true
        }));

        await db.bulkDocs(docs);
        console.log('✓ Galería limpiada');
        await loadGallery();
    } catch (error) {
        console.error('✗ Error al limpiar galería:', error);
    }
}

// Cerrar cámara
function closeCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
        video.srcObject = null;
        cameraContainer.style.display = 'none';
        openCameraBtn.textContent = '📸 Abrir Cámara';
        openCameraBtn.disabled = false;
        console.log('Cámara cerrada');
    }
}

// Event listeners
openCameraBtn.addEventListener('click', openCamera);
takePhotoBtn.addEventListener('click', takePhoto);
switchCameraBtn.addEventListener('click', switchCamera);
clearGalleryBtn.addEventListener('click', clearGallery);

window.addEventListener('beforeunload', closeCamera);

// Cargar galería al iniciar
loadGallery();
