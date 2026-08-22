export class GalacticBreaker {
    constructor(canvas, onGameOver, onScoreChange = null, getTimeRemaining = null) {
        this.canvas = canvas;
        this.onGameOver = onGameOver;
        this.onScoreChange = onScoreChange;
        this.getTimeRemaining = getTimeRemaining;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;

        this.animationId = null;
        this.isRunning = false;
        this.isServing = true;
        this.lastReportedScore = null;
        this.effectTimers = new Map();
        this.minuteBonusText = '';
        this.minuteBonusTimer = 0;
        this.slowActive = false;
        this.fireballActive = false;

        // Game Objects
        this.paddle = {
            width: 100,
            height: 15,
            x: this.width / 2 - 50,
            y: this.height - 30,
            speed: 8,
            dx: 0,
            color: '#8b5cf6',
            expandActive: false
        };

        this.ball = {
            x: this.width / 2,
            y: this.height - 50,
            radius: 8,
            speed: 5,
            dx: 0,
            dy: 0,
            color: '#fbbf24',
            trail: [],
            fireball: false
        };

        this.bricks = [];
        this.powerUps = [];
        this.particles = [];
        this.brickRowCount = 4;
        this.brickColumnCount = 9;
        this.brickWidth = 75;
        this.brickHeight = 25;
        this.brickPadding = 10;
        this.brickOffsetTop = 60;
        this.brickOffsetLeft = 30;

        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.combo = 0;

        // Brick types
        this.brickTypes = [
            { color: '#ef4444', points: 10, hits: 1 },      // Red - Basic
            { color: '#f59e0b', points: 20, hits: 2 },      // Orange - Strong
            { color: '#10b981', points: 30, hits: 3 },      // Green - Very Strong
            { color: '#3b82f6', points: 50, hits: 1, special: 'explode' }, // Blue - Explosive
            { color: '#8b5cf6', points: 100, hits: 1, special: 'multiball' }, // Purple - Multiball
            { color: '#ec4899', points: 15, hits: 1, special: 'powerup' }  // Pink - Power-up
        ];

        // Power-up types
        this.powerUpTypes = [
            { type: 'expand', color: '#10b981', symbol: '▬', duration: 10000 },
            { type: 'slow', color: '#3b82f6', symbol: '◐', duration: 7000 },
            { type: 'multiball', color: '#8b5cf6', symbol: '●●', duration: 0 },
            { type: 'fireball', color: '#fbbf24', symbol: 'F', duration: 10000 }
        ];

        this.balls = [this.ball]; // Support multiple balls

        this.initBricks();
        this.bindControls();
    }

    reportScoreIfChanged() {
        if (this.score !== this.lastReportedScore) {
            this.lastReportedScore = this.score;
            if (this.onScoreChange) {
                this.onScoreChange(this.score);
            }
        }
    }

    getRemainingSeconds() {
        if (!this.getTimeRemaining) return null;
        const remaining = Number(this.getTimeRemaining());
        return Number.isFinite(remaining) ? Math.max(0, remaining) : null;
    }

    isFinalRush() {
        const remaining = this.getRemainingSeconds();
        return remaining !== null && remaining > 0 && remaining <= 10;
    }

    getComboMultiplier() {
        return 1 + Math.min(4, Math.floor(this.combo / 4));
    }

    getScoreMultiplier() {
        return this.getComboMultiplier() * (this.isFinalRush() ? 2 : 1);
    }

    addBrickScore(points) {
        this.score += Math.round(points * this.getScoreMultiplier());
        this.combo++;
    }

    resetCombo() {
        this.combo = 0;
    }

    completeMinute() {
        const bonus = this.lives * 50;
        this.score += bonus;
        this.minuteBonusText = `MINUTE CLEAR +${bonus}`;
        this.minuteBonusTimer = 120;
        this.reportScoreIfChanged();
    }

    setTimedEffect(name, duration, activate, deactivate) {
        const existing = this.effectTimers.get(name);
        if (existing) {
            clearTimeout(existing.timeoutId);
        } else {
            activate();
        }

        const timeoutId = setTimeout(() => {
            this.effectTimers.delete(name);
            if (this.isRunning) deactivate();
        }, duration);
        this.effectTimers.set(name, { timeoutId, deactivate });
    }

    clearTimedEffects() {
        this.effectTimers.forEach(({ timeoutId }) => clearTimeout(timeoutId));
        this.effectTimers.clear();
    }

    clampPaddle() {
        if (this.paddle.x < 0) this.paddle.x = 0;
        if (this.paddle.x + this.paddle.width > this.width) {
            this.paddle.x = this.width - this.paddle.width;
        }
    }

    setPaddleCenterFromClientX(clientX) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.width / rect.width;
        const canvasX = (clientX - rect.left) * scaleX;
        this.paddle.x = canvasX - this.paddle.width / 2;
        this.paddle.dx = 0;
        this.clampPaddle();
    }

    isPointInsideCanvas(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        return (
            clientX >= rect.left &&
            clientX <= rect.right &&
            clientY >= rect.top &&
            clientY <= rect.bottom
        );
    }

    attachServeBallToPaddle() {
        if (!this.isServing || this.balls.length !== 1) return;
        const ball = this.balls[0];
        ball.x = this.paddle.x + this.paddle.width / 2;
        ball.y = this.paddle.y - ball.radius - 2;
        ball.dx = 0;
        ball.dy = 0;
        ball.trail = [];
    }

    launchServeBall() {
        if (!this.isServing || this.balls.length !== 1) return;
        const ball = this.balls[0];
        const hitPos = (ball.x - this.paddle.x) / this.paddle.width;
        const speedScale = this.slowActive ? 0.7 : 1;
        const launchSpeed = Math.min(6.5, 4 + (this.level - 1) * 0.4);
        ball.dx = ((hitPos - 0.5) * launchSpeed * 2 || launchSpeed) * speedScale;
        ball.dy = -launchSpeed * speedScale;
        this.isServing = false;
    }

    initBricks() {
        this.bricks = [];
        const specialOffset = this.level % 2;
        const guaranteedSpecials = new Map([
            [1 + specialOffset, 3],
            [4, 4],
            [7 - specialOffset, 5]
        ]);

        for (let c = 0; c < this.brickColumnCount; c++) {
            this.bricks[c] = [];
            for (let r = 0; r < this.brickRowCount; r++) {
                const brickX = c * (this.brickWidth + this.brickPadding) + this.brickOffsetLeft;
                const brickY = r * (this.brickHeight + this.brickPadding) + this.brickOffsetTop;

                let typeIndex;
                if (r === this.brickRowCount - 1 && guaranteedSpecials.has(c)) {
                    typeIndex = guaranteedSpecials.get(c);
                } else if (r === 0) {
                    typeIndex = 1; // One armored row keeps the board achievable in a minute.
                } else {
                    typeIndex = 0;
                }

                const type = this.brickTypes[typeIndex];
                this.bricks[c][r] = {
                    x: brickX,
                    y: brickY,
                    status: 1,
                    hits: type.hits,
                    maxHits: type.hits,
                    type: typeIndex
                };
            }
        }
    }

    createParticles(x, y, color, count = 10) {
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count;
            const speed = 2 + Math.random() * 3;
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1,
                color: color,
                size: 2 + Math.random() * 3
            });
        }
    }

    destroyBrick(column, row, { points = null, triggerSpecial = true } = {}) {
        const brick = this.bricks[column]?.[row];
        if (!brick || brick.status === 0) return false;

        const brickType = this.brickTypes[brick.type];
        brick.status = 0;
        this.addBrickScore(points ?? brickType.points);
        this.createParticles(
            brick.x + this.brickWidth / 2,
            brick.y + this.brickHeight / 2,
            brickType.color
        );

        if (!triggerSpecial) return true;

        if (brickType.special === 'explode') {
            for (let c = Math.max(0, column - 1); c <= Math.min(this.brickColumnCount - 1, column + 1); c++) {
                for (let r = Math.max(0, row - 1); r <= Math.min(this.brickRowCount - 1, row + 1); r++) {
                    this.destroyBrick(c, r, { points: 5, triggerSpecial: false });
                }
            }
        } else if (brickType.special === 'multiball') {
            this.applyPowerUp({ type: 'multiball' });
        } else if (brickType.special === 'powerup') {
            this.spawnPowerUp(brick.x + this.brickWidth / 2, brick.y + this.brickHeight);
        }

        return true;
    }

    spawnPowerUp(x, y) {
        const powerUp = this.powerUpTypes[Math.floor(Math.random() * this.powerUpTypes.length)];
        this.powerUps.push({
            x: x,
            y: y,
            width: 40,
            height: 20,
            speed: 2,
            rotation: 0,
            ...powerUp
        });
    }

    applyPowerUp(powerUp) {
        switch (powerUp.type) {
            case 'expand':
                this.setTimedEffect('expand', powerUp.duration, () => {
                    this.paddle.expandActive = true;
                    this.paddle.width = 150;
                    this.clampPaddle();
                }, () => {
                    this.paddle.width = 100;
                    this.paddle.expandActive = false;
                    this.clampPaddle();
                });
                break;
            case 'slow':
                this.setTimedEffect('slow', powerUp.duration, () => {
                    this.slowActive = true;
                    this.balls.forEach(b => {
                        b.dx *= 0.7;
                        b.dy *= 0.7;
                    });
                }, () => {
                    this.slowActive = false;
                    this.balls.forEach(b => {
                        b.dx /= 0.7;
                        b.dy /= 0.7;
                    });
                });
                break;
            case 'multiball': {
                const sourceBall = this.balls[0];
                if (!sourceBall) break;
                for (let i = 0; i < 2; i++) {
                    const newBall = {
                        x: sourceBall.x,
                        y: sourceBall.y,
                        radius: sourceBall.radius,
                        speed: sourceBall.speed,
                        dx: (i === 0 ? -1 : 1) * Math.max(3, Math.abs(sourceBall.dx)),
                        dy: -Math.max(3, Math.abs(sourceBall.dy)),
                        color: '#fbbf24',
                        trail: [],
                        fireball: this.fireballActive
                    };
                    this.balls.push(newBall);
                }
                break;
            }
            case 'fireball':
                this.setTimedEffect('fireball', powerUp.duration, () => {
                    this.fireballActive = true;
                    this.balls.forEach(b => b.fireball = true);
                }, () => {
                    this.fireballActive = false;
                    this.balls.forEach(b => b.fireball = false);
                });
                break;
        }
    }

    bindControls() {
        this.previousTouchAction = this.canvas.style.touchAction;
        this.canvas.style.touchAction = 'none';

        this.keyDownHandler = (e) => {
            if (e.key === 'Right' || e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
                this.paddle.dx = this.paddle.speed;
            } else if (e.key === 'Left' || e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
                this.paddle.dx = -this.paddle.speed;
            } else if (e.key === ' ') {
                e.preventDefault();
                this.launchServeBall();
            }
        };

        this.keyUpHandler = (e) => {
            if (e.key === 'Right' || e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D' ||
                e.key === 'Left' || e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
                this.paddle.dx = 0;
            }
        };

        this.pointerMoveHandler = (e) => {
            this.setPaddleCenterFromClientX(e.clientX);
        };

        this.pointerDownHandler = (e) => {
            this.setPaddleCenterFromClientX(e.clientX);
            this.launchServeBall();
        };

        this.mouseDownHandler = (e) => {
            this.setPaddleCenterFromClientX(e.clientX);
            this.launchServeBall();
        };

        this.clickHandler = (e) => {
            this.setPaddleCenterFromClientX(e.clientX);
            this.launchServeBall();
        };

        this.documentMouseDownHandler = (e) => {
            if (!this.isPointInsideCanvas(e.clientX, e.clientY)) return;
            this.setPaddleCenterFromClientX(e.clientX);
            this.launchServeBall();
        };

        this.documentPointerDownHandler = (e) => {
            if (!this.isPointInsideCanvas(e.clientX, e.clientY)) return;
            this.setPaddleCenterFromClientX(e.clientX);
            this.launchServeBall();
        };

        this.touchMoveHandler = (e) => {
            if (e.touches.length === 0) return;
            e.preventDefault();
            this.setPaddleCenterFromClientX(e.touches[0].clientX);
        };

        this.touchStartHandler = (e) => {
            if (e.touches.length === 0) return;
            e.preventDefault();
            this.setPaddleCenterFromClientX(e.touches[0].clientX);
            this.launchServeBall();
        };

        this.documentTouchStartHandler = (e) => {
            if (e.touches.length === 0) return;
            const touch = e.touches[0];
            if (!this.isPointInsideCanvas(touch.clientX, touch.clientY)) return;
            e.preventDefault();
            this.setPaddleCenterFromClientX(touch.clientX);
            this.launchServeBall();
        };

        document.addEventListener('keydown', this.keyDownHandler);
        document.addEventListener('keyup', this.keyUpHandler);
        document.addEventListener('mousedown', this.documentMouseDownHandler);
        document.addEventListener('pointerdown', this.documentPointerDownHandler);
        document.addEventListener('touchstart', this.documentTouchStartHandler, { passive: false });
        this.canvas.addEventListener('pointermove', this.pointerMoveHandler);
        this.canvas.addEventListener('pointerdown', this.pointerDownHandler);
        this.canvas.addEventListener('mousedown', this.mouseDownHandler);
        this.canvas.addEventListener('click', this.clickHandler);
        this.canvas.addEventListener('touchmove', this.touchMoveHandler, { passive: false });
        this.canvas.addEventListener('touchstart', this.touchStartHandler, { passive: false });
    }

    start() {
        this.isRunning = true;
        this.reportScoreIfChanged();
        this.loop();
    }

    pause() {
        this.isRunning = false;
        if (this.animationId) cancelAnimationFrame(this.animationId);
    }

    resume() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.loop();
        }
    }

    stop() {
        this.isRunning = false;
        if (this.animationId) cancelAnimationFrame(this.animationId);
        this.clearTimedEffects();
        document.removeEventListener('keydown', this.keyDownHandler);
        document.removeEventListener('keyup', this.keyUpHandler);
        document.removeEventListener('mousedown', this.documentMouseDownHandler);
        document.removeEventListener('pointerdown', this.documentPointerDownHandler);
        document.removeEventListener('touchstart', this.documentTouchStartHandler);
        this.canvas.removeEventListener('pointermove', this.pointerMoveHandler);
        this.canvas.removeEventListener('pointerdown', this.pointerDownHandler);
        this.canvas.removeEventListener('mousedown', this.mouseDownHandler);
        this.canvas.removeEventListener('click', this.clickHandler);
        this.canvas.removeEventListener('touchmove', this.touchMoveHandler);
        this.canvas.removeEventListener('touchstart', this.touchStartHandler);
        this.canvas.style.touchAction = this.previousTouchAction || '';
    }

    loop() {
        if (!this.isRunning) return;
        this.update();
        this.draw();
        this.animationId = requestAnimationFrame(() => this.loop());
    }

    update() {
        // Update paddle
        this.paddle.x += this.paddle.dx;
        this.clampPaddle();
        this.attachServeBallToPaddle();

        // Update balls
        for (let i = this.balls.length - 1; i >= 0; i--) {
            const ball = this.balls[i];

            if (this.isServing && this.balls.length === 1) {
                continue;
            }

            // Trail effect
            ball.trail.push({ x: ball.x, y: ball.y });
            if (ball.trail.length > 8) ball.trail.shift();

            ball.x += ball.dx;
            ball.y += ball.dy;

            // Wall collision
            if (ball.x + ball.radius > this.width || ball.x - ball.radius < 0) {
                ball.dx = -ball.dx;
            }
            if (ball.y - ball.radius < 0) {
                ball.dy = -ball.dy;
            }

            // Paddle collision
            if (ball.y + ball.radius > this.paddle.y &&
                ball.y + ball.radius < this.paddle.y + this.paddle.height &&
                ball.x > this.paddle.x &&
                ball.x < this.paddle.x + this.paddle.width) {

                // Add spin based on where ball hits paddle
                const hitPos = (ball.x - this.paddle.x) / this.paddle.width;
                ball.dx = (hitPos - 0.5) * 10;
                ball.dy = -Math.abs(ball.dy);

            }

            // Bottom collision - lose life
            if (ball.y + ball.radius > this.height) {
                this.balls.splice(i, 1);
                if (this.balls.length === 0) {
                    this.lives--;
                    this.resetCombo();
                    if (this.lives > 0) {
                        this.resetBall();
                    } else {
                        this.endGame();
                        return;
                    }
                }
            }

            // Brick collision
            for (let c = 0; c < this.brickColumnCount; c++) {
                for (let r = 0; r < this.brickRowCount; r++) {
                    const b = this.bricks[c][r];
                    if (b.status === 1) {
                        if (
                            ball.x > b.x &&
                            ball.x < b.x + this.brickWidth &&
                            ball.y > b.y &&
                            ball.y < b.y + this.brickHeight
                        ) {
                            if (ball.fireball) {
                                this.destroyBrick(c, r);
                            } else {
                                ball.dy = -ball.dy;
                                b.hits--;

                                if (b.hits <= 0) {
                                    this.destroyBrick(c, r);
                                }
                            }
                        }
                    }
                }
            }
        }

        // Update power-ups
        for (let i = this.powerUps.length - 1; i >= 0; i--) {
            const powerUp = this.powerUps[i];
            powerUp.y += powerUp.speed;
            powerUp.rotation += 0.1;

            // Check paddle collision
            if (powerUp.y + powerUp.height > this.paddle.y &&
                powerUp.y < this.paddle.y + this.paddle.height &&
                powerUp.x + powerUp.width > this.paddle.x &&
                powerUp.x < this.paddle.x + this.paddle.width) {
                this.applyPowerUp(powerUp);
                this.createParticles(powerUp.x + 20, powerUp.y + 10, powerUp.color, 15);
                this.powerUps.splice(i, 1);
                continue;
            }

            // Remove if off screen
            if (powerUp.y > this.height) {
                this.powerUps.splice(i, 1);
            }
        }

        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.1;
            p.life -= 0.02;

            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        if (this.minuteBonusTimer > 0) this.minuteBonusTimer--;

        // Check for level completion
        let activeBricks = 0;
        for (let c = 0; c < this.brickColumnCount; c++) {
            for (let r = 0; r < this.brickRowCount; r++) {
                if (this.bricks[c][r].status === 1) activeBricks++;
            }
        }

        if (activeBricks === 0) {
            this.level++;
            this.score += 200 * this.level;
            this.initBricks();
            this.resetBall({ autoLaunch: true });
        }

        this.reportScoreIfChanged();
    }

    resetBall({ autoLaunch = false } = {}) {
        this.isServing = true;
        this.balls = [{
            x: this.width / 2,
            y: this.height - 50,
            radius: 8,
            speed: 5 + (this.level - 1) * 0.5,
            dx: 0,
            dy: 0,
            color: '#fbbf24',
            trail: [],
            fireball: this.fireballActive
        }];
        this.attachServeBallToPaddle();
        if (autoLaunch) this.launchServeBall();
    }

    draw() {
        // Space background
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
        gradient.addColorStop(0, this.isFinalRush() ? '#4c0519' : '#1e1b4b');
        gradient.addColorStop(1, this.isFinalRush() ? '#1e1b4b' : '#0f172a');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.width, this.height);

        if (this.isFinalRush()) {
            this.ctx.strokeStyle = '#fb7185';
            this.ctx.lineWidth = 8;
            this.ctx.strokeRect(4, 4, this.width - 8, this.height - 8);
        }

        // Stars
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        for (let i = 0; i < 60; i++) {
            const x = (i * 123.4) % this.width;
            const y = (i * 234.5) % this.height;
            this.ctx.fillRect(x, y, 2, 2);
        }

        // Particles
        this.particles.forEach(p => {
            this.ctx.globalAlpha = p.life;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.globalAlpha = 1;

        // Bricks
        for (let c = 0; c < this.brickColumnCount; c++) {
            for (let r = 0; r < this.brickRowCount; r++) {
                if (this.bricks[c][r].status === 1) {
                    const brick = this.bricks[c][r];
                    const brickType = this.brickTypes[brick.type];

                    // Gradient fill
                    const brickGradient = this.ctx.createLinearGradient(
                        brick.x, brick.y,
                        brick.x, brick.y + this.brickHeight
                    );
                    brickGradient.addColorStop(0, brickType.color);
                    brickGradient.addColorStop(1, brickType.color + '99');

                    this.ctx.fillStyle = brickGradient;
                    this.ctx.fillRect(brick.x, brick.y, this.brickWidth, this.brickHeight);

                    // Border
                    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                    this.ctx.lineWidth = 2;
                    this.ctx.strokeRect(brick.x, brick.y, this.brickWidth, this.brickHeight);

                    // Special brick indicators
                    if (brickType.special) {
                        this.ctx.fillStyle = '#fff';
                        this.ctx.font = 'bold 16px Arial';
                        this.ctx.textAlign = 'center';
                        const symbols = { explode: '💥', multiball: '●●', powerup: '?' };
                        this.ctx.fillText(symbols[brickType.special] || '★', brick.x + this.brickWidth / 2, brick.y + this.brickHeight / 2 + 5);
                    }

                    // Health bar for multi-hit bricks
                    if (brick.maxHits > 1) {
                        const healthPercent = brick.hits / brick.maxHits;
                        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
                        this.ctx.fillRect(brick.x + 5, brick.y + this.brickHeight - 8, this.brickWidth - 10, 3);
                        this.ctx.fillStyle = '#10b981';
                        this.ctx.fillRect(brick.x + 5, brick.y + this.brickHeight - 8, (this.brickWidth - 10) * healthPercent, 3);
                    }
                }
            }
        }

        // Paddle
        const paddleGradient = this.ctx.createLinearGradient(
            this.paddle.x, this.paddle.y,
            this.paddle.x, this.paddle.y + this.paddle.height
        );
        paddleGradient.addColorStop(0, this.paddle.color);
        paddleGradient.addColorStop(1, '#6d28d9');
        this.ctx.fillStyle = paddleGradient;
        this.ctx.fillRect(this.paddle.x, this.paddle.y, this.paddle.width, this.paddle.height);

        // Paddle effects
        if (this.paddle.expandActive) {
            this.ctx.strokeStyle = '#10b981';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(this.paddle.x - 1, this.paddle.y - 1, this.paddle.width + 2, this.paddle.height + 2);
        }

        // Balls with trail
        this.balls.forEach(ball => {
            // Trail
            ball.trail.forEach((pos, i) => {
                const alpha = i / ball.trail.length;
                this.ctx.globalAlpha = alpha * 0.5;
                this.ctx.fillStyle = ball.fireball ? '#ff6b00' : ball.color;
                this.ctx.beginPath();
                this.ctx.arc(pos.x, pos.y, ball.radius * alpha, 0, Math.PI * 2);
                this.ctx.fill();
            });
            this.ctx.globalAlpha = 1;

            // Ball
            const ballGradient = this.ctx.createRadialGradient(
                ball.x - 2, ball.y - 2, 0,
                ball.x, ball.y, ball.radius
            );
            ballGradient.addColorStop(0, ball.fireball ? '#ffeb3b' : '#fef3c7');
            ballGradient.addColorStop(1, ball.fireball ? '#ff6f00' : ball.color);
            this.ctx.fillStyle = ballGradient;
            this.ctx.shadowColor = ball.fireball ? '#ff6f00' : ball.color;
            this.ctx.shadowBlur = ball.fireball ? 20 : 10;
            this.ctx.beginPath();
            this.ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
        });

        // Power-ups
        this.powerUps.forEach(powerUp => {
            this.ctx.save();
            this.ctx.translate(powerUp.x + 20, powerUp.y + 10);
            this.ctx.rotate(powerUp.rotation);

            // Glow
            this.ctx.shadowColor = powerUp.color;
            this.ctx.shadowBlur = 15;
            this.ctx.fillStyle = powerUp.color;
            this.ctx.fillRect(-20, -10, 40, 20);

            // Symbol
            this.ctx.shadowBlur = 0;
            this.ctx.fillStyle = '#fff';
            this.ctx.font = 'bold 14px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(powerUp.symbol, 0, 5);

            this.ctx.restore();
        });

        // UI
        this.ctx.fillStyle = '#fbbf24';
        this.ctx.font = 'bold 20px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.shadowColor = '#fbbf24';
        this.ctx.shadowBlur = 10;
        this.ctx.fillText(`SCORE: ${this.score}`, 10, 30);
        this.ctx.fillText(`LEVEL: ${this.level}`, 10, 55);

        if (this.combo > 0) {
            this.ctx.fillStyle = '#10b981';
            this.ctx.shadowColor = '#10b981';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(`COMBO ${this.combo}  •  SCORE x${this.getScoreMultiplier()}`, this.width / 2, 30);
        }

        this.ctx.shadowBlur = 0;
        this.ctx.fillStyle = '#ef4444';
        this.ctx.textAlign = 'right';
        this.ctx.fillText(`LIVES: ${this.lives}`, this.width - 10, 30);

        // Balls count
        if (this.balls.length > 1) {
            this.ctx.fillStyle = '#8b5cf6';
            this.ctx.fillText(`BALLS: ${this.balls.length}`, this.width - 10, 55);
        }

        if (this.isFinalRush()) {
            this.ctx.textAlign = 'center';
            this.ctx.font = 'bold 22px Arial';
            this.ctx.fillStyle = '#fda4af';
            this.ctx.shadowColor = '#fb7185';
            this.ctx.shadowBlur = 12;
            this.ctx.fillText('FINAL RUSH • DOUBLE SCORE', this.width / 2, 55);
            this.ctx.shadowBlur = 0;
        }

        if (this.minuteBonusTimer > 0) {
            this.ctx.textAlign = 'center';
            this.ctx.font = 'bold 30px Arial';
            this.ctx.fillStyle = '#fbbf24';
            this.ctx.shadowColor = '#fbbf24';
            this.ctx.shadowBlur = 16;
            this.ctx.fillText(this.minuteBonusText, this.width / 2, this.height / 2);
            this.ctx.shadowBlur = 0;
        }

        if (this.isServing) {
            this.ctx.textAlign = 'center';
            this.ctx.font = 'bold 24px Arial';
            this.ctx.fillStyle = '#f8fafc';
            this.ctx.shadowColor = '#8b5cf6';
            this.ctx.shadowBlur = 12;
            this.ctx.fillText('Press Space or tap to launch', this.width / 2, this.height / 2 + 70);
            this.ctx.shadowBlur = 0;
        }
    }

    endGame() {
        this.stop();
        this.reportScoreIfChanged();
        if (this.onGameOver) this.onGameOver(this.score);
    }
}
