// ecosystem.config.cjs — use .cjs extension to force CommonJS parsing
// even when package.json has "type": "module"
module.exports = {
  apps: [
    {
      name: "AInSight-GUI",
      script: "bash",
      args: "run_with_compositor.sh",
      cwd: "/home/yeeeecheeeen/A.InSight",
      env: {
        DISPLAY: ":0",
        XDG_RUNTIME_DIR: "/run/user/1000",
        DBUS_SESSION_BUS_ADDRESS: "unix:path=/run/user/1000/bus",
        XAUTHORITY: "/home/yeeeecheeeen/.Xauthority",
        PYTHON_KEYRING_BACKEND: "keyring.backends.null.Keyring",
        API_URL: "https://a-in-sight.vercel.app/api/config"
      }
    }
  ]
};
