class SceneManager {}
class Scene {}
class InputManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.mouse = { x: 0, y: 0, down: false, clicked: false };
        this.keysDown = new Set();
        this.keysPressed = new Set();

        canvas.addEventListener("mousemove", e => {
            const r = canvas.getBoundingClientRect();
            this.mouse.x = e.clientX - r.left;
            this.mouse.y = e.clientY - r.top;
        });

        canvas.addEventListener("mousedown", () => {
            this.mouse.down = true;
            this.mouse.clicked = true;
        });

        window.addEventListener("mouseup", () => {
            this.mouse.down = false;
        });

        window.addEventListener("keydown", e => {
            if (!this.keysDown.has(e.key)) this.keysPressed.add(e.key);
            this.keysDown.add(e.key);
        });

        window.addEventListener("keyup", e => {
            this.keysDown.delete(e.key);
        });
    }

    beginFrame() {
        this.mouse.clicked = false;
        this.keysPressed.clear();
    }

    isKeyDown(key) {
        return this.keysDown.has(key);
    }

    isKeyPressed(key) {
        return this.keysPressed.has(key);
    }
}

class UIObject {
    constructor(pos, size, parent = null) {
        this.x = pos.x;
        this.y = pos.y;
        this.width = size.x;
        this.height = size.y;
        this.parent = parent;
        this.children = [];
        this.visible = true;
        this.enabled = true;
        if (parent) parent.addChild(this);
    }

    addChild(child) {
        this.children.push(child);
        child.parent = this;
    }

    getGlobalX() {
        return this.parent ? this.parent.getGlobalX() + this.x : this.x;
    }

    getGlobalY() {
        return this.parent ? this.parent.getGlobalY() + this.y : this.y;
    }

    containsPoint(px, py) {
        const gx = this.getGlobalX();
        const gy = this.getGlobalY();
        return px >= gx && py >= gy && px <= gx + this.width && py <= gy + this.height;
    }

    update(dt, input) {
        if (!this.visible) return;
        for (const child of this.children) child.update(dt, input);
    }

    draw(ctx) {
        if (!this.visible) return;
        for (const child of this.children) child.draw(ctx);
    }
}

class Panel extends UIObject {
    constructor(pos, size, parent = null, opts = {}) {
        super(pos, size, parent);
        this.bg = opts.bg ?? "rgba(20,20,28,0.85)";
        this.border = opts.border ?? "rgba(255,255,255,0.08)";
        this.label = opts.label ?? "";
        this.labelColor = opts.labelColor ?? "#ebf5ff";
    }

    draw(ctx) {
        if (!this.visible) return;
        const gx = this.getGlobalX();
        const gy = this.getGlobalY();

        ctx.fillStyle = this.bg;
        ctx.fillRect(gx, gy, this.width, this.height);

        ctx.strokeStyle = this.border;
        ctx.strokeRect(gx, gy, this.width, this.height);

        if (this.label) {
            ctx.fillStyle = this.labelColor;
            ctx.font = "bold 14px sans-serif";
            ctx.textBaseline = "top";
            ctx.fillText(this.label, gx + 8, gy + 6);
        }

        super.draw(ctx);
    }
}

class Label extends UIObject {
    constructor(pos, size, text = "", parent = null, opts = {}) {
        super(pos, size, parent);
        this.text = text;
        this.color = opts.color ?? "#e6f0ff";
        this.font = opts.font ?? "12px monospace";
        this.align = opts.align ?? "left";
        this.bg = opts.bg ?? null;
    }

    draw(ctx) {
        if (!this.visible) return;
        const gx = this.getGlobalX();
        const gy = this.getGlobalY();

        if (this.bg) {
            ctx.fillStyle = this.bg;
            ctx.fillRect(gx, gy, this.width, this.height);
        }

        ctx.fillStyle = this.color;
        ctx.font = this.font;
        ctx.textBaseline = "middle";
        ctx.textAlign = this.align;

        let tx = gx;
        if (this.align === "left") tx += 6;
        else if (this.align === "center") tx += this.width / 2;
        else tx += this.width - 6;

        ctx.fillText(this.text, tx, gy + this.height / 2);
        super.draw(ctx);
    }
}

class Button extends UIObject {
    constructor(pos, size, text, onClick, parent = null, opts = {}) {
        super(pos, size, parent);
        this.text = text;
        this.onClick = onClick;
        this.bg = opts.bg ?? "#26303d";
        this.bgHover = opts.bgHover ?? "#35506a";
        this.textColor = opts.textColor ?? "#ebf5ff";
        this.font = opts.font ?? "12px sans-serif";
        this.hovered = false;
    }

    update(dt, input) {
        if (!this.visible || !this.enabled) return;
        this.hovered = this.containsPoint(input.mouse.x, input.mouse.y);
        if (this.hovered && input.mouse.clicked && this.onClick) {
            this.onClick();
        }
        super.update(dt, input);
    }

    draw(ctx) {
        if (!this.visible) return;
        const gx = this.getGlobalX();
        const gy = this.getGlobalY();

        ctx.fillStyle = this.hovered ? this.bgHover : this.bg;
        ctx.fillRect(gx, gy, this.width, this.height);

        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        ctx.strokeRect(gx, gy, this.width, this.height);

        ctx.fillStyle = this.textColor;
        ctx.font = this.font;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(this.text, gx + this.width / 2, gy + this.height / 2);

        super.draw(ctx);
    }
}

class HUDRoot extends UIObject {
    constructor(canvas) {
        super({ x: 0, y: 0 }, { x: canvas.width, y: canvas.height }, null);
        this.canvas = canvas;

        this.state = {
            uiMode: "starter",
            starterChosen: false,

            hiddenUi: false,
            visibilityManagerOpen: false,
            menuDropdownOpen: false,

            commandPanelOpen: false,
            buildMenuOpen: false,
            optionsOpen: false,
            managementOpen: false,

            sectionVisibility: {
                itemBar: true,
                petCommands: false,
                utilityMenu: true,
                objectiveLine: true,
            },

            objectiveSummary: {
                activeObjective: { label: "Choose Your Starter", progressText: "0/1" },
                nextObjective: null,
            },

            objectiveToast: "",
            objectiveToastTimer: 0,

            activeCommand: "follow",

            activePet: {
                state: "alive",
                name: "Dog",
                level: 5,
                hp: 110,
                maxHP: 114,
                stamina: 27,
                energy: 12,
                moveset: ["Ram", "Bite", "Guard", "Spark"],
                cooldowns: [0, 1.2, 0, 0],
            },

            items: [
                { key: "berry_red", label: "Red Berry", count: 4 },
                { key: "berry_blue", label: "Blue Berry", count: 2 },
                { key: "revive_berry", label: "Revive", count: 1 },
            ],
            selectedItemIndex: 0,
        };

        this.build();
        this.applyVisibility();
    }

    build() {
        const w = this.canvas.width;
        const h = this.canvas.height;

        this.objectiveLine = new Label(
            { x: w / 2 - 210, y: 14 },
            { x: 420, y: 22 },
            "Objective: --",
            this,
            { bg: "rgba(20,26,34,0.75)", font: "12px monospace", color: "#e6f0ff", align: "left" }
        );

        this.toast = new Label(
            { x: w / 2 - 150, y: h - 160 },
            { x: 300, y: 24 },
            "",
            this,
            { bg: "rgba(24,42,28,0.8)", font: "bold 12px sans-serif", color: "#d2ffd2", align: "center" }
        );

        this.uiButton = new Button(
            { x: 14, y: 14 },
            { x: 88, y: 30 },
            "UI ▾",
            () => {
                this.state.visibilityManagerOpen = !this.state.visibilityManagerOpen;
                this.applyVisibility();
            },
            this
        );

        this.visibilityPanel = new Panel(
            { x: 14, y: 50 },
            { x: 220, y: 188 },
            this,
            { bg: "rgba(20,24,32,0.9)" }
        );

        this.addVisibilityButtons();

        this.menuButton = new Button(
            { x: w - 110, y: 14 },
            { x: 96, y: 30 },
            "Menu ▾",
            () => {
                this.state.menuDropdownOpen = !this.state.menuDropdownOpen;
                this.applyVisibility();
            },
            this
        );

        this.menuDropdown = new Panel(
            { x: w - 214, y: 50 },
            { x: 200, y: 150 },
            this,
            { bg: "rgba(20,24,32,0.92)" }
        );

        this.addMenuButtons();

        this.commandPanel = new Panel(
            { x: w / 2 - 250, y: h - 140 },
            { x: 500, y: 88 },
            this,
            { bg: "rgba(20,20,28,0.88)" }
        );

        this.addCommandButtons();
        this.abilityButtons = [];
        this.buildAbilityButtons();

        this.itemPanel = new Panel(
            { x: w / 2 - 250, y: h - 50 },
            { x: 500, y: 42 },
            this,
            { bg: "rgba(20,20,28,0.88)" }
        );

        this.buildItemButtons();

        this.buildPanel = new Panel(
            { x: w - 320, y: 80 },
            { x: 300, y: 280 },
            this,
            { bg: "rgba(20,20,28,0.92)", label: "Build / Action" }
        );

        this.optionsPanel = new Panel(
            { x: w - 320, y: 80 },
            { x: 300, y: 180 },
            this,
            { bg: "rgba(20,20,28,0.94)", label: "Options" }
        );

        this.managementPanel = new Panel(
            { x: w / 2 - 220, y: h / 2 - 150 },
            { x: 440, y: 300 },
            this,
            { bg: "rgba(20,20,30,0.94)", label: "Creature Management" }
        );

        this.closeOptionsButton = new Button(
            { x: 300 - 82, y: 6 },
            { x: 74, y: 22 },
            "Close",
            () => {
                this.state.optionsOpen = false;
                this.applyVisibility();
            },
            this.optionsPanel
        );
    }

    addVisibilityButtons() {
        const defs = [
            ["Toggle Item Bar", () => {
                this.state.sectionVisibility.itemBar = !this.state.sectionVisibility.itemBar;
                this.applyVisibility();
            }],
            ["Toggle Pet Commands", () => {
                this.state.sectionVisibility.petCommands = !this.state.sectionVisibility.petCommands;
                if (!this.state.sectionVisibility.petCommands) this.state.commandPanelOpen = false;
                this.applyVisibility();
            }],
            ["Toggle Utility Menu", () => {
                this.state.sectionVisibility.utilityMenu = !this.state.sectionVisibility.utilityMenu;
                if (!this.state.sectionVisibility.utilityMenu) {
                    this.state.menuDropdownOpen = false;
                    this.state.buildMenuOpen = false;
                }
                this.applyVisibility();
            }],
            ["Toggle Objective Line", () => {
                this.state.sectionVisibility.objectiveLine = !this.state.sectionVisibility.objectiveLine;
                this.applyVisibility();
            }],
            ["Hide All", () => {
                this.state.hiddenUi = true;
                this.state.menuDropdownOpen = false;
                this.state.buildMenuOpen = false;
                this.state.commandPanelOpen = false;
                this.state.optionsOpen = false;
                this.state.managementOpen = false;
                this.applyVisibility();
            }],
            ["Show Default", () => this.applyDefaultUiVisibility()],
        ];

        defs.forEach((d, i) => {
            new Button({ x: 6, y: 8 + i * 28 }, { x: 208, y: 24 }, d[0], d[1], this.visibilityPanel);
        });
    }

    addMenuButtons() {
        const defs = [
            ["Build / Action", () => {
                this.state.buildMenuOpen = !this.state.buildMenuOpen;
                this.state.optionsOpen = false;
                this.state.managementOpen = false;
                this.state.menuDropdownOpen = false;
                this.applyVisibility();
            }],
            ["Creature Management", () => {
                this.state.managementOpen = true;
                this.state.optionsOpen = false;
                this.state.buildMenuOpen = false;
                this.state.menuDropdownOpen = false;
                this.applyVisibility();
            }],
            ["Pet Commands", () => {
                this.state.commandPanelOpen = !this.state.commandPanelOpen;
                this.state.menuDropdownOpen = false;
                this.applyVisibility();
            }],
            ["Options", () => {
                this.state.optionsOpen = true;
                this.state.managementOpen = false;
                this.state.buildMenuOpen = false;
                this.state.menuDropdownOpen = false;
                this.applyVisibility();
            }],
        ];

        defs.forEach((d, i) => {
            new Button({ x: 6, y: 6 + i * 30 }, { x: 188, y: 26 }, d[0], d[1], this.menuDropdown);
        });
    }

    addCommandButtons() {
        const defs = [
            ["Follow", "follow"],
            ["Hold", "hold"],
            ["Attack", "attack"],
        ];

        defs.forEach((d, i) => {
            new Button(
                { x: 6 + i * 102, y: 6 },
                { x: 96, y: 22 },
                d[0],
                () => {
                    this.state.activeCommand = d[1];
                },
                this.commandPanel
            );
        });
    }

    buildAbilityButtons() {
        for (let i = 0; i < 4; i++) {
            const btn = new Button(
                { x: 6 + i * 122, y: 34 },
                { x: 116, y: 42 },
                `[${i + 1}] --`,
                () => this.triggerHotbarSlot(i),
                this.commandPanel
            );
            this.abilityButtons.push(btn);
        }
    }

    buildItemButtons() {
        this.itemButtons = [];
        for (let i = 0; i < 6; i++) {
            const btn = new Button(
                { x: 8 + i * 80, y: 3 },
                { x: 72, y: 34 },
                "--",
                () => {
                    if (this.state.items[i]) {
                        this.state.selectedItemIndex = i;
                    }
                },
                this.itemPanel
            );
            this.itemButtons.push(btn);
        }
    }

    triggerHotbarSlot(index) {
        const pet = this.state.activePet;
        if (!pet || pet.state !== "alive") {
            this.showObjectiveToast("Active pet unavailable");
            return;
        }
        const move = pet.moveset[index];
        if (!move) {
            this.showObjectiveToast(`Ability ${index + 1} empty`);
            return;
        }
        this.showObjectiveToast(`Cast ${move}`);
    }

    applyDefaultUiVisibility() {
        this.state.hiddenUi = false;
        this.state.menuDropdownOpen = false;
        this.state.visibilityManagerOpen = false;
        this.state.commandPanelOpen = false;
        this.state.buildMenuOpen = false;
        this.state.optionsOpen = false;
        this.state.managementOpen = false;
        this.state.sectionVisibility.itemBar = true;
        this.state.sectionVisibility.petCommands = false;
        this.state.sectionVisibility.utilityMenu = true;
        this.state.sectionVisibility.objectiveLine = true;
        this.applyVisibility();
    }

    applyVisibility() {
        const s = this.state;
        const inGameplay = s.uiMode === "gameplay";
        const showGameplay = inGameplay && !s.hiddenUi;

        this.uiButton.text = s.visibilityManagerOpen ? "UI ▴" : "UI ▾";
        this.menuButton.text = s.menuDropdownOpen ? "Menu ▴" : "Menu ▾";

        this.visibilityPanel.visible = inGameplay && s.visibilityManagerOpen;
        this.menuButton.visible = inGameplay && s.sectionVisibility.utilityMenu;
        this.menuDropdown.visible = inGameplay && s.sectionVisibility.utilityMenu && s.menuDropdownOpen && !s.hiddenUi;

        this.objectiveLine.visible = showGameplay && s.sectionVisibility.objectiveLine;
        this.commandPanel.visible = showGameplay && s.sectionVisibility.petCommands && s.commandPanelOpen;
        this.itemPanel.visible = showGameplay && s.sectionVisibility.itemBar;

        this.buildPanel.visible = showGameplay && s.sectionVisibility.utilityMenu && s.buildMenuOpen;
        this.optionsPanel.visible = showGameplay && s.optionsOpen;
        this.managementPanel.visible = showGameplay && s.managementOpen;
        this.toast.visible = showGameplay && s.objectiveToastTimer > 0;

        this.refreshTexts();
    }

    refreshTexts() {
        const s = this.state;
        const active = s.objectiveSummary.activeObjective;
        const nextObj = s.objectiveSummary.nextObjective;

        if (active) {
            this.objectiveLine.text = `Objective: ${active.label} (${active.progressText})`;
        } else if (nextObj) {
            this.objectiveLine.text = `Next: ${nextObj.label}`;
        } else {
            this.objectiveLine.text = "Objectives complete";
        }

        this.commandPanel.children.forEach(ch => {
            if (ch instanceof Button) {
                const key = ch.text.toLowerCase();
                const activeMatch =
                    (key.includes("follow") && s.activeCommand === "follow") ||
                    (key.includes("hold") && s.activeCommand === "hold") ||
                    (key.includes("attack") && s.activeCommand === "attack");
                ch.bg = activeMatch ? "#466991" : "#282d3a";
            }
        });

        const pet = s.activePet;
        this.abilityButtons.forEach((btn, i) => {
            const move = pet?.moveset?.[i];
            const cd = pet?.cooldowns?.[i] ?? 0;
            if (!move) {
                btn.text = `[${i + 1}] --`;
                btn.bg = "#282c34";
            } else if (cd > 0) {
                btn.text = `[${i + 1}] ${move} (${cd.toFixed(1)}s)`;
                btn.bg = "#41322d";
            } else {
                btn.text = `[${i + 1}] ${move}`;
                btn.bg = "#233e36";
            }
        });

        this.itemButtons.forEach((btn, i) => {
            const item = s.items[i];
            if (!item) {
                btn.text = "--";
                btn.visible = false;
                return;
            }
            btn.visible = true;
            btn.text = `${item.label}\n${i + 1}:${item.count}`;
            btn.bg = s.selectedItemIndex === i ? "#3f5f7a" : "#222834";
        });

        this.toast.text = s.objectiveToast;
    }

    showObjectiveToast(text) {
        this.state.objectiveToast = text;
        this.state.objectiveToastTimer = 2.0;
        this.applyVisibility();
    }

    update(dt, input) {
        this.width = this.canvas.width;
        this.height = this.canvas.height;

        if (input.isKeyPressed("o")) {
            this.state.optionsOpen = !this.state.optionsOpen;
            if (this.state.optionsOpen) {
                this.state.buildMenuOpen = false;
                this.state.managementOpen = false;
            }
            this.applyVisibility();
        }

        if (input.isKeyPressed("m")) {
            this.state.managementOpen = !this.state.managementOpen;
            if (this.state.managementOpen) {
                this.state.optionsOpen = false;
                this.state.buildMenuOpen = false;
            }
            this.applyVisibility();
        }

        if (this.state.objectiveToastTimer > 0) {
            this.state.objectiveToastTimer -= dt;
            if (this.state.objectiveToastTimer <= 0) {
                this.state.objectiveToastTimer = 0;
                this.state.objectiveToast = "";
                this.applyVisibility();
            }
        }

        super.update(dt, input);
    }
}

class HUDScene extends Scene {
    constructor(canvas) {
        super();
        this.canvas = canvas;
        this.input = new InputManager(canvas);
        this.hud = new HUDRoot(canvas);

        setTimeout(() => {
            this.hud.state.starterChosen = true;
            this.hud.state.uiMode = "gameplay";
            this.hud.applyDefaultUiVisibility();
        }, 800);
    }

    update(dt) {
        this.hud.update(dt, this.input);
    }

    render(ctx) {
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.fillStyle = "#12161b";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.hud.draw(ctx);
        this.input.beginFrame();
    }
}
