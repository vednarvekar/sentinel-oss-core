import { useEffect, useRef } from "react";

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  connections: number[];
  pulse: number;
  pulseSpeed: number;
  type: "file" | "folder" | "module";
}

const CodebaseBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const nodesRef = useRef<Node[]>([]);
  const frameRef = useRef(0);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initNodes();
    };

    const initNodes = () => {
      const nodes: Node[] = [];
      const count = Math.min(Math.floor((canvas.width * canvas.height) / 25000), 80);
      
      for (let i = 0; i < count; i++) {
        const type = Math.random() < 0.15 ? "module" : Math.random() < 0.3 ? "folder" : "file";
        nodes.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.15,
          vy: (Math.random() - 0.5) * 0.15,
          radius: type === "module" ? 3 : type === "folder" ? 2.5 : 1.5,
          connections: [],
          pulse: Math.random() * Math.PI * 2,
          pulseSpeed: 0.008 + Math.random() * 0.012,
          type,
        });
      }

      // Create connections (dependency graph style)
      for (let i = 0; i < nodes.length; i++) {
        const maxConn = nodes[i].type === "module" ? 5 : nodes[i].type === "folder" ? 3 : 2;
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 200 && nodes[i].connections.length < maxConn) {
            nodes[i].connections.push(j);
          }
        }
      }
      nodesRef.current = nodes;
    };

    const draw = () => {
      frameRef.current += 1;
      const time = frameRef.current * 0.016;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const nodes = nodesRef.current;

      // Update positions
      for (const node of nodes) {
        node.x += node.vx;
        node.y += node.vy;
        node.pulse += node.pulseSpeed;

        // Mouse interaction — gentle repulsion
        const dmx = node.x - mx;
        const dmy = node.y - my;
        const dmDist = Math.sqrt(dmx * dmx + dmy * dmy);
        if (dmDist < 150 && dmDist > 0) {
          const force = (150 - dmDist) / 150 * 0.3;
          node.vx += (dmx / dmDist) * force * 0.05;
          node.vy += (dmy / dmDist) * force * 0.05;
        }

        // Damping
        node.vx *= 0.995;
        node.vy *= 0.995;

        // Boundary wrap
        if (node.x < -20) node.x = canvas.width + 20;
        if (node.x > canvas.width + 20) node.x = -20;
        if (node.y < -20) node.y = canvas.height + 20;
        if (node.y > canvas.height + 20) node.y = -20;
      }

      // Draw connections
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        for (const j of node.connections) {
          const other = nodes[j];
          const dx = other.x - node.x;
          const dy = other.y - node.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < 250) {
            const alpha = Math.max(0, (1 - dist / 250)) * 0.08;
            
            // Proximity to mouse makes lines brighter
            const midX = (node.x + other.x) / 2;
            const midY = (node.y + other.y) / 2;
            const mouseDist = Math.sqrt((midX - mx) ** 2 + (midY - my) ** 2);
            const mouseBoost = mouseDist < 200 ? (1 - mouseDist / 200) * 0.12 : 0;

            ctx.beginPath();
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(other.x, other.y);
            ctx.strokeStyle = `hsla(212, 60%, 55%, ${alpha + mouseBoost})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // Draw nodes
      for (const node of nodes) {
        const pulseFactor = 0.5 + Math.sin(node.pulse) * 0.5;
        const mouseDist = Math.sqrt((node.x - mx) ** 2 + (node.y - my) ** 2);
        const mouseGlow = mouseDist < 150 ? (1 - mouseDist / 150) * 0.4 : 0;

        const baseAlpha = node.type === "module" ? 0.3 : node.type === "folder" ? 0.2 : 0.12;
        const alpha = baseAlpha + pulseFactor * 0.1 + mouseGlow;

        // Node glow
        if (node.type === "module" || mouseGlow > 0.1) {
          const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, node.radius * 4);
          const hue = node.type === "module" ? "130, 50%, 45%" : "212, 60%, 55%";
          gradient.addColorStop(0, `hsla(${hue}, ${alpha * 0.4})`);
          gradient.addColorStop(1, `hsla(${hue}, 0)`);
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius * 4, 0, Math.PI * 2);
          ctx.fillStyle = gradient;
          ctx.fill();
        }

        // Node dot
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        const hue = node.type === "module" ? "130, 50%, 45%" : node.type === "folder" ? "212, 60%, 55%" : "210, 15%, 60%";
        ctx.fillStyle = `hsla(${hue}, ${alpha})`;
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    const handleMouse = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 };
    };

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", handleMouse);
    window.addEventListener("mouseleave", handleMouseLeave);
    resize();
    draw();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouse);
      window.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(animRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0"
      style={{ opacity: 0.7 }}
    />
  );
};

export default CodebaseBackground;
