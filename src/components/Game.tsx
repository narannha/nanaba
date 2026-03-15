import React, { useEffect, useRef, useState } from 'react';
import { Play, RotateCcw, Zap, Flag } from 'lucide-react';

import bananaSvg from '../../assets/banana.svg';
import espaldaNanaSvg from '../../assets/espalda nana.svg';
import troncoSvg from '../../assets/tronco.svg';
import nanaSvg from '../../assets/nana.svg';
import espaldaMonoSvg from '../../assets/espalda mono.svg';
import monoSvg from '../../assets/mono.svg';

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
}

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>({
    isPlaying: false,
    gameOver: false,
    hasWon: false,
    score: 0,
    peelsCollected: 0,
    monkeyDistance: 100,
    progress: 0,
  });

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
      
      state.objects.push({
        x: 0, // Calculated dynamically
        y: -100,
        width: type === 'log' ? OBSTACLE_WIDTH : POWERUP_WIDTH,
        height: type === 'log' ? OBSTACLE_HEIGHT : POWERUP_HEIGHT,
        type: type,
        active: true,
        laneOffset: laneOffset
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
        const monoScale = 1.3;
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
        const scale = 1.3;
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
    
    const pScale = 1.3;
    ctx.drawImage(imgEspaldaNana, -(PLAYER_WIDTH * pScale)/2, -(PLAYER_HEIGHT * pScale)/2, PLAYER_WIDTH * pScale, PLAYER_HEIGHT * pScale);
    
    ctx.restore();

    // Monkey (if close)
    const pixelDistance = stateRef.current.monkeyDistance * 8; // 1 unit = 8 pixels
    const monkeyY = stateRef.current.playerY + pixelDistance;

    if (monkeyY < CANVAS_HEIGHT + 150) {
      const monkeyX = stateRef.current.playerX; // Chasing player x
      
      ctx.save();
      ctx.translate(monkeyX + PLAYER_WIDTH/2, monkeyY + PLAYER_HEIGHT/2);
      
      ctx.drawImage(imgEspaldaMono, -45, -45, 90, 90);

      ctx.restore();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-900 text-white font-sans">
      <div className="mb-4 text-center">
        <h1 className="text-4xl font-bold text-yellow-400 mb-2">Nanaba</h1>
        <p className="text-zinc-400">Run from the monkey! WASD to move.</p>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="bg-zinc-800 rounded-lg shadow-2xl border-4 border-zinc-700"
        />

        {/* HUD Top */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
          <div className="bg-black/60 p-2 rounded-lg backdrop-blur-sm border border-white/10">
            <div className="text-xs text-zinc-400 uppercase tracking-wider flex items-center gap-1">
              <Zap size={12} className="text-yellow-400" /> Energía
            </div>
            <div className="text-2xl font-mono text-yellow-400">{gameState.peelsCollected}</div>
          </div>
          
          <div className="bg-black/60 p-2 rounded-lg backdrop-blur-sm w-48 border border-white/10">
            <div className="text-xs text-zinc-400 uppercase tracking-wider mb-1">Distancia del Mono</div>
            <div className="h-3 bg-zinc-800 rounded-full overflow-hidden border border-white/5">
              <div 
                className={`h-full transition-all duration-200 ${
                  gameState.monkeyDistance < 30 ? 'bg-red-500' : 
                  gameState.monkeyDistance < 60 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.max(0, gameState.monkeyDistance)}%` }}
              />
            </div>
          </div>
        </div>

        {/* HUD Bottom - Progress Bar */}
        <div className="absolute bottom-4 left-4 right-4 pointer-events-none">
          <div className="bg-black/60 p-2 rounded-lg backdrop-blur-sm border border-white/10">
            <div className="flex justify-between text-xs text-zinc-400 uppercase tracking-wider mb-1">
              <span>Inicio</span>
              <span className="flex items-center gap-1"><Flag size={12} /> Meta</span>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden border border-white/5 relative">
              <div 
                className="h-full bg-lime-400 shadow-[0_0_10px_rgba(163,230,53,0.8)] transition-all duration-200"
                style={{ width: `${gameState.progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Start Screen */}
        {!gameState.isPlaying && !gameState.gameOver && !gameState.hasWon && (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-lg overflow-hidden">
            <div 
              className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?q=80&w=1000&auto=format&fit=crop')] bg-cover bg-center opacity-60"
              style={{ animation: 'panImage 30s linear infinite alternate' }}
            />
            <style>{`
              @keyframes panImage {
                0% { transform: scale(1) translate(0, 0); }
                100% { transform: scale(1.1) translate(-2%, -2%); }
              }
            `}</style>
            <div className="absolute inset-0 bg-[#0a1f0d]/70 backdrop-blur-sm" />
            
            <div className="relative z-10 flex flex-col items-center p-8">
              <img src={bananaSvg} alt="Banana" className="w-16 h-16 mb-4 drop-shadow-xl" />
              <h2 className="text-3xl font-bold mb-4 text-yellow-300 uppercase tracking-widest drop-shadow-lg">Nanaba</h2>
              <div className="space-y-4 text-center mb-8 text-zinc-100 bg-black/40 p-6 rounded-xl border border-white/20 text-base leading-relaxed max-w-sm backdrop-blur-md shadow-2xl">
                <p>
                  En lo profundo de la selva, una banana muy peculiar intenta sobrevivir.
                </p>
                <p>
                  Un mono hambriento la ha elegido como su próxima comida y la persecución ha comenzado.
                </p>
                <p>
                  Mientras escapa, la banana puede recolectar cáscaras con los que ganas mini-boost
                </p>
                <p className="text-yellow-300 font-medium">
                  Pero en la selva cada decisión importa, porque una cáscara puede salvarte o convertirte en el almuerzo del mono. 🍌🐒
                </p>
              </div>
              <button
                onClick={startGame}
                className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-black font-bold py-4 px-10 rounded-full transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(253,224,71,0.4)]"
              >
                <Play size={24} fill="currentColor" />
                COMENZAR
              </button>
            </div>
          </div>
        )}

        {/* Win Screen */}
        {gameState.hasWon && (
          <div className="absolute inset-0 bg-green-900/90 flex flex-col items-center justify-center rounded-lg backdrop-blur-md">
            <img src={nanaSvg} alt="Nana" className="w-24 h-24 mb-4 drop-shadow-xl" />
            <h2 className="text-4xl font-bold mb-2 text-white">¡ESCAPASTE!</h2>
            <p className="text-xl text-green-200 mb-6">La banana vivirá un día más.</p>
            
            <div className="flex gap-4 mb-8">
              <div className="bg-black/40 p-4 rounded-xl text-center border border-white/10">
                <div className="text-sm text-zinc-400 uppercase tracking-wider">Tiempo</div>
                <div className="text-3xl font-mono text-white">{gameState.score}s</div>
              </div>
              <div className="bg-black/40 p-4 rounded-xl text-center border border-white/10">
                <div className="text-sm text-zinc-400 uppercase tracking-wider">Energía</div>
                <div className="text-3xl font-mono text-yellow-400">{gameState.peelsCollected}</div>
              </div>
            </div>

            <button
              onClick={startGame}
              className="flex items-center gap-2 bg-white hover:bg-zinc-200 text-green-900 font-bold py-3 px-8 rounded-full transition-transform hover:scale-105 active:scale-95"
            >
              <RotateCcw size={24} />
              Jugar de Nuevo
            </button>
          </div>
        )}

        {/* Game Over Screen */}
        {gameState.gameOver && (
          <div className="absolute inset-0 bg-red-900/90 flex flex-col items-center justify-center rounded-lg backdrop-blur-md">
            <div className="text-6xl mb-4">🐒</div>
            <h2 className="text-4xl font-bold mb-2 text-white">¡ATRAPADO!</h2>
            <p className="text-xl text-red-200 mb-6">El mono te alcanzó.</p>
            
            <div className="flex gap-4 mb-8">
              <div className="bg-black/40 p-4 rounded-xl text-center border border-white/10">
                <div className="text-sm text-zinc-400 uppercase tracking-wider">Progreso</div>
                <div className="text-3xl font-mono text-white">{Math.floor(gameState.progress)}%</div>
              </div>
              <div className="bg-black/40 p-4 rounded-xl text-center border border-white/10">
                <div className="text-sm text-zinc-400 uppercase tracking-wider">Energía</div>
                <div className="text-3xl font-mono text-yellow-400">{gameState.peelsCollected}</div>
              </div>
            </div>

            <button
              onClick={startGame}
              className="flex items-center gap-2 bg-white hover:bg-zinc-200 text-red-900 font-bold py-3 px-8 rounded-full transition-transform hover:scale-105 active:scale-95"
            >
              <RotateCcw size={24} />
              Reintentar
            </button>
          </div>
        )}
      </div>
      
      <div className="mt-6 text-zinc-500 text-sm max-w-md text-center">
        Usa <kbd className="bg-zinc-800 px-2 py-1 rounded text-zinc-300">A</kbd> y <kbd className="bg-zinc-800 px-2 py-1 rounded text-zinc-300">D</kbd> para girar. <kbd className="bg-zinc-800 px-2 py-1 rounded text-zinc-300">W</kbd> para acelerar, <kbd className="bg-zinc-800 px-2 py-1 rounded text-zinc-300">S</kbd> para frenar.
      </div>
    </div>
  );
}
