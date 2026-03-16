import React, { useEffect, useRef, useState } from 'react';
import { Play, RotateCcw, Zap, Flag, Settings, User, Trophy, Info, X, Star } from 'lucide-react';

import bananaSvg from '../../assets/banana.svg';
import espaldaNanaSvg from '../../assets/espalda nana.svg';
import troncoSvg from '../../assets/tronco.svg';
import nanaSvg from '../../assets/nana.svg';
import espaldaMonoSvg from '../../assets/espalda mono.svg';
import monoSvg from '../../assets/mono.svg';

const musicUrl = "https://cdn.pixabay.com/audio/2022/01/18/audio_d0a13f69d2.mp3"; // Upbeat game-like track

const imgBanana = new Image();
imgBanana.src = bananaSvg;

const imgEspaldaNana = new Image();
imgEspaldaNana.src = espaldaNanaSvg;

const imgTronco = new Image();
imgTronco.src = troncoSvg;

const imgNana = new Image();
imgNana.src = nanaSvg;

const imgEspaldaMono = new Image();
imgEspaldaMono.src = espaldaMonoSvg;

const imgMono = new Image();
imgMono.src = monoSvg;

// Game Constants
const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 800;
const ROAD_WIDTH = 340;
const PLAYER_WIDTH = 40;
const PLAYER_HEIGHT = 60;
const OBSTACLE_WIDTH = 50;
const OBSTACLE_HEIGHT = 40;
const POWERUP_WIDTH = 30;
const POWERUP_HEIGHT = 30;

const FPS = 60;
const BASE_SPEED = 5;
const MAX_SPEED = 12;
const BOOST_SPEED = 15;
const BOOST_DURATION = 100; // Frames
const TOTAL_DISTANCE = 20000; // Finish line distance

interface GameObject {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'log' | 'peel';
  active: boolean;
  laneOffset: number;
  moveDir?: number;
  moveSpeed?: number;
}

interface TreeObject {
  xOffset: number;
  y: number;
  size: number;
  type: number;
}

interface GameState {
  isPlaying: boolean;
  gameOver: boolean;
  hasWon: boolean;
  score: number; // Time survived in seconds
  peelsCollected: number;
  monkeyDistance: number; // 0-100, 0 means caught
  progress: number; // 0-100
  showOptions: boolean;
  showProfile: boolean;
  showAchievements: boolean;
  playerName: string;
  volume: number;
}

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    isPlaying: false,
    gameOver: false,
    hasWon: false,
    score: 0,
    peelsCollected: 0,
    monkeyDistance: 100,
    progress: 0,
    showOptions: false,
    showProfile: false,
    showAchievements: false,
    playerName: 'Player 1',
    volume: 0.5,
  });

  useEffect(() => {
    if (gameState.isPlaying) {
      if (!audioRef.current) {
        audioRef.current = new Audio(musicUrl);
        audioRef.current.loop = true;
      }
      // Ensure volume is a finite number between 0 and 1
      const safeVolume = Number.isFinite(gameState.volume) 
        ? Math.max(0, Math.min(1, gameState.volume)) 
        : 0.5;
      audioRef.current.volume = safeVolume;
      audioRef.current.play().catch(e => console.log("Audio play failed:", e));
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    }
  }, [gameState.isPlaying, gameState.volume]);

  // Game Mutable State (Refs for performance in loop)
  const stateRef = useRef({
    playerX: CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2,
    playerY: CANVAS_HEIGHT - 150,
    speed: BASE_SPEED,
    boostTimer: 0,
    objects: [] as GameObject[],
    trees: [] as TreeObject[],
    frame: 0,
    roadOffset: 0,
    distanceTraveled: 0,
    monkeyDistance: 100,
    peelsCollected: 0,
    keys: {
      w: false,
      a: false,
      s: false,
      d: false,
    },
    lastTime: 0,
    scoreTimer: 0,
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (stateRef.current.keys.hasOwnProperty(key)) {
        stateRef.current.keys[key as keyof typeof stateRef.current.keys] = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (stateRef.current.keys.hasOwnProperty(key)) {
        stateRef.current.keys[key as keyof typeof stateRef.current.keys] = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const startGame = () => {
    stateRef.current = {
      playerX: CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2,
      playerY: CANVAS_HEIGHT - 150,
      speed: BASE_SPEED,
      boostTimer: 0,
      objects: [],
      trees: [],
      frame: 0,
      roadOffset: 0,
      distanceTraveled: 0,
      monkeyDistance: 100,
      peelsCollected: 0,
      keys: { w: false, a: false, s: false, d: false },
      lastTime: performance.now(),
      scoreTimer: 0,
    };
    setGameState({ 
      isPlaying: true, 
      gameOver: false, 
      hasWon: false,
      score: 0, 
      peelsCollected: 0,
      monkeyDistance: 100,
      progress: 0
    });
    requestAnimationFrame(gameLoop);
  };

  const getRoadCenter = (y: number, roadOffset: number) => {
    // Creates a winding curve effect - increased amplitude for more noticeable curves
    const t = (roadOffset - y) * 0.002;
    const curve1 = Math.sin(t) * 150; // Increased from 100
    const curve2 = Math.sin(t * 0.5) * 80; // Increased from 60
    return CANVAS_WIDTH / 2 + curve1 + curve2;
  };

  const gameLoop = (time: number) => {
    if (!stateRef.current.lastTime) stateRef.current.lastTime = time;
    const deltaTime = time - stateRef.current.lastTime;
    
    // Update logic
    const shouldContinue = update(deltaTime);
    
    // Draw
    draw();

    stateRef.current.lastTime = time;

    if (shouldContinue) {
      requestAnimationFrame(gameLoop);
    }
  };

  const update = (deltaTime: number) => {
    const state = stateRef.current;
    
    if (state.distanceTraveled >= TOTAL_DISTANCE) {
      setGameState(prev => ({ ...prev, isPlaying: false, hasWon: true }));
      return false;
    }

    if (state.monkeyDistance <= 0) {
      setGameState(prev => ({ ...prev, isPlaying: false, gameOver: true }));
      return false;
    }

    // Player Movement
    const moveSpeed = 6;
    if (state.keys.a) state.playerX -= moveSpeed;
    if (state.keys.d) state.playerX += moveSpeed;
    if (state.keys.w) state.playerY -= moveSpeed;
    // Removed 's' key moving player down to prevent moving backwards

    // Speed & Boost
    if (state.boostTimer > 0) {
      // Gradual acceleration to BOOST_SPEED
      if (state.speed < BOOST_SPEED) {
        state.speed += 0.5; // Accelerate
      }
      state.boostTimer--;
    } else {
      // Gradual deceleration to BASE_SPEED
      if (state.speed > BASE_SPEED) {
        state.speed -= 0.2; // Decelerate
      } else if (state.speed < BASE_SPEED) {
        // Recovery from stun or slow
        state.speed += 0.1;
      }
      
      // If pressing W, slight speed up (risk/reward)
      if (state.keys.w && state.speed < MAX_SPEED) state.speed += 0.1;
      // If pressing S, slight slow down (braking only, no backward movement)
      if (state.keys.s && state.speed > 2) state.speed -= 0.1;
    }

    // Road Scrolling
    state.roadOffset += state.speed;
    state.distanceTraveled += state.speed;

    // Boundaries based on curve
    const currentRoadCenter = getRoadCenter(state.playerY, state.roadOffset);
    const roadLeft = currentRoadCenter - ROAD_WIDTH / 2;
    const roadRight = currentRoadCenter + ROAD_WIDTH / 2;
    
    if (state.playerX < roadLeft) state.playerX = roadLeft;
    if (state.playerX + PLAYER_WIDTH > roadRight) state.playerX = roadRight - PLAYER_WIDTH;
    if (state.playerY < 300) state.playerY = 300; // Limit forward movement to give more top space
    if (state.playerY > CANVAS_HEIGHT - PLAYER_HEIGHT - 20) state.playerY = CANVAS_HEIGHT - PLAYER_HEIGHT - 20;

    // Object Spawning
    state.frame++;
    if (state.frame % 60 === 0) { // Spawn every second approx
      const type = Math.random() > 0.3 ? 'log' : 'peel';
      // 3 lanes
      const lane = Math.floor(Math.random() * 3) - 1; // -1, 0, 1
      const laneOffset = lane * (ROAD_WIDTH / 3);
      
      const logWidth = type === 'log' ? OBSTACLE_WIDTH * (Math.random() * 1.5 + 0.5) : POWERUP_WIDTH;
      const logHeight = type === 'log' ? OBSTACLE_HEIGHT * (Math.random() * 0.5 + 0.8) : POWERUP_HEIGHT;

      state.objects.push({
        x: 0, // Calculated dynamically
        y: -100,
        width: logWidth,
        height: logHeight,
        type: type,
        active: true,
        laneOffset: laneOffset,
        moveDir: type === 'log' ? (Math.random() > 0.5 ? 1 : -1) : 0,
        moveSpeed: type === 'log' ? Math.random() * 3 + 1 : 0
      });
    }

    // Tree/Plant Spawning outside the path
    if (state.frame % 15 === 0) {
      const isLeft = Math.random() > 0.5;
      const xOffset = isLeft 
        ? -ROAD_WIDTH/2 - Math.random() * 100 - 40 
        : ROAD_WIDTH/2 + Math.random() * 100 + 40;
      
      state.trees.push({
        xOffset,
        y: -100,
        size: Math.random() * 40 + 40,
        type: Math.floor(Math.random() * 4) // 0-3 for different plants
      });
    }

    // Update Objects
    state.objects.forEach(obj => {
      obj.y += state.speed;
      
      if (obj.type === 'log' && obj.moveDir !== undefined && obj.moveSpeed !== undefined) {
        obj.laneOffset += obj.moveDir * obj.moveSpeed;
        const limit = ROAD_WIDTH / 2 - obj.width / 2;
        if (Math.abs(obj.laneOffset) > limit) {
          obj.moveDir *= -1;
          obj.laneOffset = Math.sign(obj.laneOffset) * limit;
        }
      }
      
      obj.x = getRoadCenter(obj.y, state.roadOffset) + obj.laneOffset - obj.width / 2;
    });
    state.objects = state.objects.filter(obj => obj.y < CANVAS_HEIGHT + 100);

    // Update Trees
    state.trees.forEach(tree => {
      tree.y += state.speed;
    });
    state.trees = state.trees.filter(tree => tree.y < CANVAS_HEIGHT + 150);

    // Collision Detection
    const playerRect = { x: state.playerX, y: state.playerY, width: PLAYER_WIDTH, height: PLAYER_HEIGHT };
    
    state.objects.forEach(obj => {
      if (!obj.active) return;
      
      const objRect = { x: obj.x, y: obj.y, width: obj.width, height: obj.height };
      
      if (checkCollision(playerRect, objRect)) {
        if (obj.type === 'log') {
          // Hit Log
          state.monkeyDistance -= 15; // Monkey gets closer
          state.speed = 1; // Stunned
          obj.active = false;
        } else if (obj.type === 'peel') {
          // Hit Peel
          state.monkeyDistance = Math.min(100, state.monkeyDistance + 10); // Gain distance
          state.boostTimer = BOOST_DURATION;
          state.peelsCollected++;
          obj.active = false;
        }
      }
    });

    // Monkey Logic
    // Monkey slowly creeps up naturally
    state.monkeyDistance -= 0.05;
    
    // Score & Progress
    state.scoreTimer += deltaTime;
    if (state.scoreTimer > 1000) {
      setGameState(prev => ({
        ...prev,
        score: prev.score + 1,
        monkeyDistance: Math.floor(state.monkeyDistance),
        peelsCollected: state.peelsCollected,
        progress: Math.min(100, (state.distanceTraveled / TOTAL_DISTANCE) * 100)
      }));
      state.scoreTimer = 0;
    }

    return true;
  };

  const checkCollision = (rect1: any, rect2: any) => {
    return (
      rect1.x < rect2.x + rect2.width &&
      rect1.x + rect1.width > rect2.x &&
      rect1.y < rect2.y + rect2.height &&
      rect1.y + rect1.height > rect2.y
    );
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear Background (Vibrant Jungle Floor)
    ctx.fillStyle = '#1b5e20'; // More saturated dark green
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw Path Area (Green jungle path to show limits)
    const sliceHeight = 10;
    for (let y = 0; y < CANVAS_HEIGHT; y += sliceHeight) {
      const centerX = getRoadCenter(y, stateRef.current.roadOffset);
      
      // Path Border (Darker green to show limits)
      ctx.fillStyle = '#2e7d32'; // More saturated border
      ctx.fillRect(centerX - ROAD_WIDTH/2 - 10, y, ROAD_WIDTH + 20, sliceHeight + 1);
      
      // Path Surface (Lighter green)
      ctx.fillStyle = '#4caf50'; // More vibrant green path
      ctx.fillRect(centerX - ROAD_WIDTH/2, y, ROAD_WIDTH, sliceHeight + 1);
    }

    // Draw Trees and Jungle Objects Outside
    stateRef.current.trees.forEach(tree => {
      const centerX = getRoadCenter(tree.y, stateRef.current.roadOffset);
      const treeX = centerX + tree.xOffset;
      
      ctx.save();
      ctx.translate(treeX, tree.y);
      
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(0, tree.size/2, tree.size/2, tree.size/4, 0, 0, Math.PI * 2);
      ctx.fill();

      if (tree.type === 3) {
        // Draw mono.svg instead of exotic plant
        const monoScale = 0.7; // Reduced from 0.9
        ctx.drawImage(imgMono, -(tree.size * monoScale)/2, -(tree.size * monoScale), tree.size * monoScale, tree.size * monoScale);
      } else {
        // Draw a standard jungle tree/bush
        ctx.fillStyle = '#5d4037'; // More saturated Trunk
        ctx.fillRect(-tree.size/8, 0, tree.size/4, tree.size/2);
        
        ctx.fillStyle = tree.type === 0 ? '#2e7d32' : tree.type === 1 ? '#558b2f' : '#00e676'; // More vibrant leaves
        ctx.beginPath();
        ctx.arc(0, -tree.size/4, tree.size/1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-tree.size/3, -tree.size/2, tree.size/2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(tree.size/3, -tree.size/2, tree.size/2, 0, Math.PI * 2);
        ctx.fill();
      }
      
      ctx.restore();
    });

    // Finish Line
    const distanceRemaining = TOTAL_DISTANCE - stateRef.current.distanceTraveled;
    // Show finish line when it's within 2x canvas height to ensure it doesn't "pop in"
    if (distanceRemaining < CANVAS_HEIGHT * 2) {
      const finishY = stateRef.current.playerY - distanceRemaining;
      const centerX = getRoadCenter(finishY, stateRef.current.roadOffset);
      
      // Only draw if it's on screen
      if (finishY > -100 && finishY < CANVAS_HEIGHT + 100) {
        // Draw checkered line
        const squareSize = 20;
        for (let i = 0; i < ROAD_WIDTH / squareSize; i++) {
          ctx.fillStyle = i % 2 === 0 ? 'white' : 'black';
          ctx.fillRect(centerX - ROAD_WIDTH/2 + i * squareSize, finishY, squareSize, squareSize);
          ctx.fillStyle = i % 2 === 0 ? 'black' : 'white';
          ctx.fillRect(centerX - ROAD_WIDTH/2 + i * squareSize, finishY + squareSize, squareSize, squareSize);
        }
      }
    }

    // Objects
    stateRef.current.objects.forEach(obj => {
      if (!obj.active) return;
      
      if (obj.type === 'log') {
        ctx.drawImage(imgTronco, obj.x, obj.y, obj.width, obj.height);
      } else {
        const scale = 2.2; // Increased from 1.8
        const dw = obj.width * scale;
        const dh = obj.height * scale;
        ctx.drawImage(imgBanana, obj.x - (dw - obj.width)/2, obj.y - (dh - obj.height)/2, dw, dh);
      }
    });

    // Player (Banana)
    const { playerX, playerY } = stateRef.current;
    ctx.save();
    ctx.translate(playerX + PLAYER_WIDTH/2, playerY + PLAYER_HEIGHT/2);
    // Wobble animation
    if (stateRef.current.speed > BASE_SPEED) {
      ctx.rotate(Math.sin(stateRef.current.frame * 0.5) * 0.1);
    }
    
    const pScale = 2.2; // Increased from 1.8
    ctx.drawImage(imgEspaldaNana, -(PLAYER_WIDTH * pScale)/2, -(PLAYER_HEIGHT * pScale)/2, PLAYER_WIDTH * pScale, PLAYER_HEIGHT * pScale);
    
    ctx.restore();

    // Monkey (if close)
    const pixelDistance = stateRef.current.monkeyDistance * 8; // 1 unit = 8 pixels
    const monkeyY = stateRef.current.playerY + pixelDistance;

    if (monkeyY < CANVAS_HEIGHT + 150) {
      const monkeyX = stateRef.current.playerX; // Chasing player x
      
      ctx.save();
      ctx.translate(monkeyX + PLAYER_WIDTH/2, monkeyY + PLAYER_HEIGHT/2);
      
      ctx.drawImage(imgEspaldaMono, -80, -80, 160, 160); // Increased from 130x130

      ctx.restore();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#1a3d1d] text-white font-sans overflow-hidden">
      <div className="relative w-full max-w-[400px]">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="bg-[#2e7d32] rounded-xl shadow-2xl border-8 border-[#5d4037]"
        />

        {/* HUD Top */}
        <div className="absolute top-6 left-6 right-6 flex justify-between items-start pointer-events-none">
          <div className="bg-[#5d4037]/90 p-3 rounded-lg border-2 border-[#8d6e63] shadow-lg">
            <div className="text-[10px] text-[#d7ccc8] uppercase font-black flex items-center gap-1 mb-1">
              <Zap size={12} className="text-yellow-400" /> ENERGÍA
            </div>
            <div className="text-3xl font-black text-yellow-400 leading-none drop-shadow-sm">{gameState.peelsCollected}</div>
          </div>
          
          <div className="bg-[#5d4037]/90 p-3 rounded-lg border-2 border-[#8d6e63] shadow-lg w-40">
            <div className="text-[10px] text-[#d7ccc8] uppercase font-black mb-2">DISTANCIA MONO</div>
            <div className="h-4 bg-[#3e2723] rounded-full overflow-hidden border-2 border-[#2d1b18] p-0.5">
              <div 
                className={`h-full rounded-full transition-all duration-300 ${
                  gameState.monkeyDistance < 30 ? 'bg-red-500' : 
                  gameState.monkeyDistance < 60 ? 'bg-orange-500' : 'bg-lime-500'
                }`}
                style={{ width: `${Math.max(0, gameState.monkeyDistance)}%` }}
              />
            </div>
          </div>
        </div>

        {/* HUD Bottom - Progress Bar */}
        <div className="absolute bottom-6 left-6 right-6 pointer-events-none">
          <div className="bg-[#5d4037]/90 p-3 rounded-lg border-2 border-[#8d6e63] shadow-lg">
            <div className="flex justify-between text-[10px] text-[#d7ccc8] font-black uppercase mb-2">
              <span>INICIO</span>
              <span className="flex items-center gap-1"><Flag size={12} /> META</span>
            </div>
            <div className="h-3 bg-[#3e2723] rounded-full overflow-hidden border-2 border-[#2d1b18]">
              <div 
                className="h-full bg-lime-400 shadow-[0_0_15px_rgba(163,230,53,0.6)] transition-all duration-300"
                style={{ width: `${gameState.progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Start Screen */}
        {!gameState.isPlaying && !gameState.gameOver && !gameState.hasWon && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm rounded-lg">
            <div className="relative w-[90%] bg-[#5d4037] p-8 rounded-2xl border-8 border-[#3e2723] shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col items-center">
              {/* Wooden Planks Texture */}
              <div className="absolute inset-0 opacity-20 pointer-events-none rounded-lg overflow-hidden" 
                   style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 40px, #000 41px)', backgroundSize: '100% 41px' }} />
              
              <div className="relative z-10 w-full flex flex-col items-center">
                <img src={nanaSvg} alt="Nana" className="w-16 h-16 mb-4 drop-shadow-lg" />
                <div className="bg-[#3e2723] px-6 py-2 rounded-full border-2 border-[#8d6e63] mb-8 shadow-inner">
                  <h1 className="text-4xl font-black text-yellow-400 tracking-widest italic drop-shadow-md">NANABA</h1>
                </div>

                <div className="grid grid-cols-1 gap-4 w-full mb-8">
                  <button 
                    onClick={startGame}
                    className="group relative bg-[#8d6e63] hover:bg-[#a1887f] p-4 rounded-xl border-b-8 border-[#3e2723] active:border-b-0 active:translate-y-2 transition-all flex items-center justify-center gap-3"
                  >
                    <Play className="text-yellow-400 fill-yellow-400 group-hover:scale-110 transition-transform" size={28} />
                    <span className="text-2xl font-black italic tracking-tighter">JUGAR</span>
                  </button>

                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => setGameState(prev => ({ ...prev, showOptions: true }))}
                      className="bg-[#6d4c41] hover:bg-[#795548] p-3 rounded-xl border-b-4 border-[#3e2723] active:border-b-0 active:translate-y-1 transition-all flex flex-col items-center gap-1"
                    >
                      <Settings size={20} className="text-[#d7ccc8]" />
                      <span className="text-xs font-black italic">OPCIONES</span>
                    </button>
                    <button 
                      onClick={() => setGameState(prev => ({ ...prev, showAchievements: true }))}
                      className="bg-[#6d4c41] hover:bg-[#795548] p-3 rounded-xl border-b-4 border-[#3e2723] active:border-b-0 active:translate-y-1 transition-all flex flex-col items-center gap-1"
                    >
                      <Trophy size={20} className="text-[#d7ccc8]" />
                      <span className="text-xs font-black italic">LOGROS</span>
                    </button>
                    <button 
                      onClick={() => setGameState(prev => ({ ...prev, showProfile: true }))}
                      className="bg-[#6d4c41] hover:bg-[#795548] p-3 rounded-xl border-b-4 border-[#3e2723] active:border-b-0 active:translate-y-1 transition-all flex flex-col items-center gap-1"
                    >
                      <User size={20} className="text-[#d7ccc8]" />
                      <span className="text-xs font-black italic">PERFIL</span>
                    </button>
                    <button className="bg-[#6d4c41] hover:bg-[#795548] p-3 rounded-xl border-b-4 border-[#3e2723] active:border-b-0 active:translate-y-1 transition-all flex flex-col items-center gap-1">
                      <Star size={20} className="text-[#d7ccc8]" />
                      <span className="text-xs font-black italic">EXTRA</span>
                    </button>
                  </div>
                </div>

                <button className="w-full bg-[#3e2723] hover:bg-[#4e342e] p-3 rounded-xl border-b-4 border-[#1b110f] active:border-b-0 active:translate-y-1 transition-all text-[#8d6e63] font-black italic text-sm">
                  SALIR
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Game Over Screen */}
        {gameState.gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-900/40 backdrop-blur-sm rounded-lg">
            <div className="bg-[#5d4037] p-8 rounded-2xl border-8 border-[#3e2723] shadow-2xl flex flex-col items-center max-w-[80%]">
              <div className="bg-red-600 px-6 py-2 rounded-full border-2 border-red-400 mb-6 shadow-lg -rotate-3">
                <h2 className="text-3xl font-black text-white italic tracking-tighter">¡TE ATRAPARON!</h2>
              </div>
              <p className="text-[#d7ccc8] font-bold mb-6 text-center italic">El mono te alcanzó antes de llegar a la meta.</p>
              <button
                onClick={startGame}
                className="w-full bg-yellow-400 hover:bg-yellow-300 text-[#3e2723] p-4 rounded-xl border-b-8 border-yellow-600 active:border-b-0 active:translate-y-2 transition-all font-black text-xl italic"
              >
                REINTENTAR
              </button>
            </div>
          </div>
        )}

        {/* Win Screen */}
        {gameState.hasWon && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-lime-900/40 backdrop-blur-sm rounded-lg">
            <div className="bg-[#5d4037] p-8 rounded-2xl border-8 border-[#3e2723] shadow-2xl flex flex-col items-center max-w-[80%]">
              <div className="bg-lime-500 px-6 py-2 rounded-full border-2 border-lime-300 mb-6 shadow-lg rotate-3">
                <h2 className="text-3xl font-black text-white italic tracking-tighter">¡ESCAPASTE!</h2>
              </div>
              
              <img src={nanaSvg} alt="Nana" className="w-16 h-16 mb-6 drop-shadow-lg" />

              <div className="flex gap-4 mb-8">
                <div className="bg-[#3e2723] p-3 rounded-xl border-2 border-[#8d6e63] flex flex-col items-center">
                  <span className="text-[10px] text-[#8d6e63] font-black uppercase">ENERGÍA</span>
                  <span className="text-2xl font-black text-yellow-400">{gameState.peelsCollected}</span>
                </div>
                <div className="bg-[#3e2723] p-3 rounded-xl border-2 border-[#8d6e63] flex flex-col items-center">
                  <span className="text-[10px] text-[#8d6e63] font-black uppercase">TIEMPO</span>
                  <span className="text-2xl font-black text-white">{gameState.score}s</span>
                </div>
              </div>
              <button
                onClick={startGame}
                className="w-full bg-yellow-400 hover:bg-yellow-300 text-[#3e2723] p-4 rounded-xl border-b-8 border-yellow-600 active:border-b-0 active:translate-y-2 transition-all font-black text-xl italic"
              >
                JUGAR DE NUEVO
              </button>
            </div>
          </div>
        )}

        {/* Modals */}
        {gameState.showOptions && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
            <div className="bg-[#5d4037] w-full max-w-[320px] p-6 rounded-2xl border-8 border-[#3e2723] shadow-2xl relative">
              <button 
                onClick={() => setGameState(prev => ({ ...prev, showOptions: false }))}
                className="absolute -top-4 -right-4 bg-red-600 p-2 rounded-full border-4 border-[#3e2723] text-white shadow-lg"
              >
                <X size={20} />
              </button>
              <h2 className="text-2xl font-black text-yellow-400 italic mb-6 text-center uppercase tracking-widest">OPCIONES</h2>
              
              <div className="space-y-6">
                <div>
                  <label className="text-xs font-black text-[#d7ccc8] uppercase mb-2 block">VOLUMEN MÚSICA</label>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.1" 
                    value={gameState.volume}
                    onChange={(e) => setGameState(prev => ({ ...prev, volume: parseFloat(e.target.value) }))}
                    className="w-full h-4 bg-[#3e2723] rounded-full appearance-none cursor-pointer accent-yellow-400"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black text-[#d7ccc8] uppercase">PANTALLA COMPLETA</span>
                  <input type="checkbox" className="w-6 h-6 accent-lime-500" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black text-[#d7ccc8] uppercase">MODO EXPERTO</span>
                  <input type="checkbox" className="w-6 h-6 accent-lime-500" />
                </div>
              </div>
            </div>
          </div>
        )}

        {gameState.showProfile && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
            <div className="bg-[#5d4037] w-full max-w-[320px] p-6 rounded-2xl border-8 border-[#3e2723] shadow-2xl relative">
              <button 
                onClick={() => setGameState(prev => ({ ...prev, showProfile: false }))}
                className="absolute -top-4 -right-4 bg-red-600 p-2 rounded-full border-4 border-[#3e2723] text-white shadow-lg"
              >
                <X size={20} />
              </button>
              <h2 className="text-2xl font-black text-yellow-400 italic mb-6 text-center uppercase tracking-widest">PERFIL</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-black text-[#d7ccc8] uppercase mb-2 block">NOMBRE JUGADOR</label>
                  <input 
                    type="text" 
                    value={gameState.playerName}
                    onChange={(e) => setGameState(prev => ({ ...prev, playerName: e.target.value }))}
                    className="w-full bg-[#3e2723] p-3 rounded-xl border-2 border-[#8d6e63] text-white font-bold focus:outline-none focus:border-yellow-400"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button className="bg-lime-600 p-3 rounded-xl border-b-4 border-lime-800 font-black italic text-xs">CREAR</button>
                  <button className="bg-red-600 p-3 rounded-xl border-b-4 border-red-800 font-black italic text-xs">BORRAR</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {gameState.showAchievements && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
            <div className="bg-[#5d4037] w-full max-w-[320px] p-6 rounded-2xl border-8 border-[#3e2723] shadow-2xl relative">
              <button 
                onClick={() => setGameState(prev => ({ ...prev, showAchievements: false }))}
                className="absolute -top-4 -right-4 bg-red-600 p-2 rounded-full border-4 border-[#3e2723] text-white shadow-lg"
              >
                <X size={20} />
              </button>
              <h2 className="text-2xl font-black text-yellow-400 italic mb-6 text-center uppercase tracking-widest">LOGROS</h2>
              
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {[
                  { name: 'Primer Escape', done: true },
                  { name: 'Coleccionista', done: false },
                  { name: 'Velocidad Pura', done: true },
                  { name: 'Intocable', done: false },
                  { name: 'Maestro Mono', done: false },
                ].map((ach, i) => (
                  <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border-2 ${ach.done ? 'bg-[#3e2723] border-lime-500/50' : 'bg-[#3e2723]/50 border-[#8d6e63]/30'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${ach.done ? 'bg-lime-500 text-white' : 'bg-[#2d1b18] text-[#8d6e63]'}`}>
                      {ach.done ? <Trophy size={16} /> : <Star size={16} />}
                    </div>
                    <span className={`text-sm font-bold italic ${ach.done ? 'text-white' : 'text-[#8d6e63]'}`}>{ach.name}</span>
                    {ach.done && <div className="ml-auto w-2 h-2 bg-lime-500 rounded-full shadow-[0_0_8px_rgba(132,204,22,0.8)]" />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #3e2723;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #8d6e63;
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}
