document.addEventListener('DOMContentLoaded', () => {
    // 1. 요소 선택
    const boardElement = document.getElementById('game-board');
    const scoreElement = document.getElementById('score');
    const bestElement = document.getElementById('best');
    const gameOverElement = document.getElementById('game-over');
    const resetBtn = document.getElementById('reset-btn');
    const undoBtn = document.getElementById('undo-btn');
    const retryBtn = document.getElementById('retry-btn');

    let board = [];
    let score = 0;
    let history = [];
    let audioCtx = null;

    // 2. 오디오 엔진 (오프라인에서도 작동하는 내장 주파수 방식)
    const initAudio = () => {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') audioCtx.resume();
    };

    const playSound = (isMerge) => {
        if (!audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = isMerge ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(isMerge ? 600 : 400, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1);
        
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    };

    // 3. 게임 로직
    function initGame() {
        board = Array(4).fill().map(() => Array(4).fill(0));
        score = 0;
        history = [];
        gameOverElement.classList.add('hidden');
        addRandomTile();
        addRandomTile();
        renderBoard();
    }

    function addRandomTile() {
        let empty = [];
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                if (board[r][c] === 0) empty.push({r, c});
            }
        }
        if (empty.length > 0) {
            let {r, c} = empty[Math.floor(Math.random() * empty.length)];
            board[r][c] = Math.random() < 0.9 ? 2 : 4;
        }
    }

    function renderBoard() {
        boardElement.innerHTML = '';
        board.forEach(row => {
            row.forEach(val => {
                const tile = document.createElement('div');
                tile.className = `tile ${val > 0 ? 'tile-' + val : ''}`;
                tile.textContent = val > 0 ? val : '';
                boardElement.appendChild(tile);
            });
        });
        scoreElement.textContent = score;
        let best = localStorage.getItem('bestScore') || 0;
        if (score > best) {
            localStorage.setItem('bestScore', score);
            best = score;
        }
        bestElement.textContent = best;
    }

    function slide(row) {
        let arr = row.filter(n => n !== 0);
        let merged = false;
        for (let i = 0; i < arr.length - 1; i++) {
            if (arr[i] === arr[i + 1]) {
                arr[i] *= 2;
                score += arr[i];
                arr[i + 1] = 0;
                merged = true;
            }
        }
        if (merged) playSound(true);
        arr = arr.filter(n => n !== 0);
        while (arr.length < 4) arr.push(0);
        return arr;
    }

    function move(dir) {
        initAudio(); // 사용자 상호작용 시 오디오 활성화
        let oldBoard = JSON.stringify(board);
        let tempBoard = JSON.parse(oldBoard);
        let tempScore = score;

        for (let i = 0; i < 4; i++) {
            let row = [];
            if (dir === 'L' || dir === 'R') {
                row = [...board[i]];
                if (dir === 'R') row.reverse();
                let newRow = slide(row);
                if (dir === 'R') newRow.reverse();
                board[i] = newRow;
            } else {
                row = [board[0][i], board[1][i], board[2][i], board[3][i]];
                if (dir === 'D') row.reverse();
                let newRow = slide(row);
                if (dir === 'D') newRow.reverse();
                for (let j = 0; j < 4; j++) board[j][i] = newRow[j];
            }
        }

        if (oldBoard !== JSON.stringify(board)) {
            history.push({ board: tempBoard, score: tempScore });
            if (history.length > 20) history.shift();
            playSound(false);
            addRandomTile();
            renderBoard();
            if (isGameOver()) gameOverElement.classList.remove('hidden');
        }
    }

    function isGameOver() {
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                if (board[r][c] === 0) return false;
                if (c < 3 && board[r][c] === board[r][c + 1]) return false;
                if (r < 3 && board[r][c] === board[r + 1][c]) return false;
            }
        }
        return true;
    }

    // 4. 이벤트 리스너 (터치 제어)
    let startX, startY;
    boardElement.addEventListener('touchstart', e => {
        initAudio();
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    }, {passive: true});

    boardElement.addEventListener('touchend', e => {
        if (!startX || !startY) return;
        let dx = e.changedTouches[0].clientX - startX;
        let dy = e.changedTouches[0].clientY - startY;
        if (Math.abs(dx) > Math.abs(dy)) {
            if (Math.abs(dx) > 30) move(dx > 0 ? 'R' : 'L');
        } else {
            if (Math.abs(dy) > 30) move(dy > 0 ? 'D' : 'U');
        }
        startX = startY = null;
    }, {passive: true});

    // 5. 버튼 기능 연결
    resetBtn.onclick = initGame;
    retryBtn.onclick = initGame;
    undoBtn.onclick = () => {
        if (history.length > 0) {
            let last = history.pop();
            board = last.board;
            score = last.score;
            renderBoard();
            gameOverElement.classList.add('hidden');
        }
    };

    // 6. 오프라인 지원 (Service Worker 등록)
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js').then(() => {
                console.log("Offline Cache Ready");
            }).catch(err => console.log("SW Register Failed", err));
        });
    }

    initGame();
});
