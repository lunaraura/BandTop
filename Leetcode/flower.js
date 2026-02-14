const EntityManager = {
  list: new Set(),

  add(e) { this.list.add(e); },

  update(dt) {
    for (const e of this.list) e.update(dt);
    for (const e of this.list) {
      if (!e.alive) this.list.delete(e);
    }
  },

  draw(ctx, camera) {
    [...this.list]
      .sort((a, b) => a.wy - b.wy)
      .forEach(e => e.draw(ctx, camera));
  }
};

