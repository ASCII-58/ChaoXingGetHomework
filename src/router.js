class Router {
  constructor(onChange) {
    this.routes = {};
    this.current = null;
    this.onChange = onChange;
    window.addEventListener("hashchange", () => this.resolve());
  }

  route(path, handler) {
    this.routes[path] = handler;
    return this;
  }

  navigate(path) {
    window.location.hash = path;
  }

  getCurrent() {
    return this.current;
  }

  resolve() {
    const path = window.location.hash.slice(1) || "/login";
    const handler = this.routes[path];
    if (handler && path !== this.current) {
      this.current = path;
      handler();
      if (this.onChange) this.onChange(path);
    }
  }

  start() {
    if (!window.location.hash) {
      window.location.hash = "#/login";
    } else {
      this.resolve();
    }
  }
}

export { Router };
