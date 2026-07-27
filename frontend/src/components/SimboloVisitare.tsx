// Símbolo Visitare (a porta que se abre) — mesmas coordenadas de
// site/public/favicon.svg e frontend/brand/icon-app.svg. Herda a cor de quem o
// contém via currentColor, para servir tanto sobre teal quanto sobre ivory.
export function SimboloVisitare({ className = 'h-8' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100.33 142.39"
      className={className}
      role="img"
      aria-label="Visitare"
      fill="none"
    >
      <polygon
        fill="currentColor"
        opacity="0.55"
        points="20.73,41.74 20.73,34.23 27.23,30.48 80.02,0 0,0 0,100.33 20.73,100.33 20.73,41.74"
      />
      <polygon
        fill="currentColor"
        points="100.33,103.94 100.33,3.28 33.73,41.74 33.73,142.39"
      />
    </svg>
  )
}
