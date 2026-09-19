const video = document.getElementById('video');
const frameEl = document.getElementById('frame');
const cameraWindow = document.getElementById('cameraWindow');
const shutter = document.getElementById('shutter');
const switchCameraBtn = document.getElementById('switchCamera');
const changeFrameBtn = document.getElementById('changeFrame');
const captureCanvas = document.getElementById('captureCanvas');
const resultImage = document.getElementById('resultImage');
const cameraScreen = document.getElementById('cameraScreen');
const resultScreen = document.getElementById('resultScreen');
const saveBtn = document.getElementById('save');
const retakeBtn = document.getElementById('retake');
const flash = document.getElementById('flash');
const certification = document.getElementById('certification');
const confettiCanvas = document.getElementById('confettiCanvas');
const frameLabel = document.getElementById('frameLabel');
const cameraModeText = document.getElementById('cameraModeText');

const FRAME_W = 1024;
const FRAME_H = 1536;

/*
  IMPORTANT:
  All four PNGs already use the SAME camera window.
  Therefore the camera geometry must also be shared by every frame.
  Do NOT define per-frame window coordinates.
*/
const COMMON_WINDOW = {
  x: 220,
  y: 315,
  w: 590,
  h: 900,
  r: 42
};

const normalFrames = [
  {src:'frames/frame01.png', label:'やくざいしになってみよう！'},
  {src:'frames/frame02.png', label:'おくすりマスター！'},
  {src:'frames/frame03.png', label:'みらいのやくざいし！'}
];

const rareFrame = {
  src:'frames/frame_rare.png',
  label:'レア！ スーパーやくざいし！'
};

let currentFrame;
let facingMode = 'environment';
let stream;
let resultBlob;

function applyWindowGeometry(){
  const w = COMMON_WINDOW;
  cameraWindow.style.setProperty('--x', `${w.x / FRAME_W * 100}%`);
  cameraWindow.style.setProperty('--y', `${w.y / FRAME_H * 100}%`);
  cameraWindow.style.setProperty('--w', `${w.w / FRAME_W * 100}%`);
  cameraWindow.style.setProperty('--h', `${w.h / FRAME_H * 100}%`);
  cameraWindow.style.setProperty('--r', `${w.r / Math.min(w.w,w.h) * 100}%`);
}

function chooseFrame(){
  currentFrame = Math.floor(Math.random()*6) === 0
    ? rareFrame
    : normalFrames[Math.floor(Math.random()*normalFrames.length)];

  frameEl.src = currentFrame.src;
  frameLabel.textContent = currentFrame.label;
  // Same window for every frame
  applyWindowGeometry();
}

async function startCamera(){
  if(stream) stream.getTracks().forEach(t=>t.stop());

  try{
    stream = await navigator.mediaDevices.getUserMedia({
      audio:false,
      video:{
        facingMode:{ideal:facingMode},
        width:{ideal:1920},
        height:{ideal:1080}
      }
    });

    // Prefer a real rear camera when environment is requested
    if(facingMode === 'environment' && navigator.mediaDevices.enumerateDevices){
      const currentTrack = stream.getVideoTracks()[0];
      const settings = currentTrack.getSettings ? currentTrack.getSettings() : {};

      if(settings.facingMode && settings.facingMode !== 'environment'){
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        const rear = videoDevices.find(d => /back|rear|environment|背面/i.test(d.label));

        if(rear){
          stream.getTracks().forEach(t=>t.stop());
          stream = await navigator.mediaDevices.getUserMedia({
            audio:false,
            video:{
              deviceId:{exact:rear.deviceId},
              width:{ideal:1920},
              height:{ideal:1080}
            }
          });
        }
      }
    }

    video.srcObject = stream;
    video.style.transform = facingMode === 'user' ? 'scaleX(-1)' : 'none';
    cameraModeText.textContent =
      facingMode === 'environment' ? '背面カメラ' : '自撮りカメラ';

  }catch(err){
    console.error(err);
    alert('カメラを起動できませんでした。ブラウザのカメラ許可を確認してください。');
  }
}

function drawVideoCover(ctx, source, x, y, w, h, mirror=false){
  const sw = source.videoWidth;
  const sh = source.videoHeight;
  const scale = Math.max(w/sw, h/sh);
  const dw = sw*scale;
  const dh = sh*scale;
  const dx = x + (w-dw)/2;
  const dy = y + (h-dh)/2;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, COMMON_WINDOW.r);
  ctx.clip();

  if(mirror){
    ctx.translate(x+w,0);
    ctx.scale(-1,1);
    ctx.drawImage(source, -(dx-x)-dw, dy, dw, dh);
  }else{
    ctx.drawImage(source, dx, dy, dw, dh);
  }
  ctx.restore();
}

function runConfetti(duration=500){
  const rect = confettiCanvas.getBoundingClientRect();
  const dpr = devicePixelRatio || 1;
  confettiCanvas.width = rect.width*dpr;
  confettiCanvas.height = rect.height*dpr;
  const ctx = confettiCanvas.getContext('2d');
  ctx.scale(dpr,dpr);

  const colors = ['#ef4e72','#ffd23f','#36b5d8','#61c454','#ff8b2d'];
  const pieces = Array.from({length:90},()=>({
    x:Math.random()*rect.width,
    y:-20-Math.random()*rect.height*.25,
    vx:(Math.random()-.5)*5,
    vy:3+Math.random()*6,
    s:5+Math.random()*8,
    r:Math.random()*Math.PI,
    vr:(Math.random()-.5)*.3,
    c:colors[Math.floor(Math.random()*colors.length)]
  }));

  const start = performance.now();

  function tick(now){
    ctx.clearRect(0,0,rect.width,rect.height);
    for(const p of pieces){
      p.x+=p.vx;
      p.y+=p.vy;
      p.r+=p.vr;
      ctx.save();
      ctx.translate(p.x,p.y);
      ctx.rotate(p.r);
      ctx.fillStyle=p.c;
      ctx.fillRect(-p.s/2,-p.s/3,p.s,p.s*.65);
      ctx.restore();
    }
    if(now-start<duration) requestAnimationFrame(tick);
    else ctx.clearRect(0,0,rect.width,rect.height);
  }

  requestAnimationFrame(tick);
}

async function capture(){
  if(!video.videoWidth) return;

  shutter.disabled = true;

  flash.classList.add('on');
  setTimeout(()=>flash.classList.remove('on'),180);

  certification.classList.add('show');
  runConfetti(500);

  captureCanvas.width = FRAME_W;
  captureCanvas.height = FRAME_H;
  const ctx = captureCanvas.getContext('2d');

  ctx.fillStyle = '#fff7d8';
  ctx.fillRect(0,0,FRAME_W,FRAME_H);

  const w = COMMON_WINDOW;

  drawVideoCover(
    ctx,
    video,
    w.x,w.y,w.w,w.h,
    facingMode === 'user'
  );

  const img = new Image();
  img.src = currentFrame.src;
  await img.decode();
  ctx.drawImage(img,0,0,FRAME_W,FRAME_H);

  await new Promise(r=>setTimeout(r,500));
  certification.classList.remove('show');

  resultBlob = await new Promise(resolve =>
    captureCanvas.toBlob(resolve,'image/png',1)
  );

  resultImage.src = URL.createObjectURL(resultBlob);
  cameraScreen.classList.add('hidden');
  resultScreen.classList.remove('hidden');
  shutter.disabled = false;
}

async function saveImage(){
  const file = new File([resultBlob], 'pharmacist-photo.png', {type:'image/png'});

  if(navigator.canShare && navigator.canShare({files:[file]})){
    try{
      await navigator.share({files:[file], title:'薬剤師体験フォト'});
      return;
    }catch(e){
      if(e.name==='AbortError') return;
    }
  }

  const url = URL.createObjectURL(resultBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pharmacist-photo.png';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

switchCameraBtn.addEventListener('click', async ()=>{
  facingMode = facingMode === 'environment' ? 'user' : 'environment';
  await startCamera();
});

changeFrameBtn.addEventListener('click', chooseFrame);
shutter.addEventListener('click', capture);
saveBtn.addEventListener('click', saveImage);

retakeBtn.addEventListener('click', ()=>{
  resultScreen.classList.add('hidden');
  cameraScreen.classList.remove('hidden');
});

applyWindowGeometry();
chooseFrame();
startCamera();
