interface BadgeProps {
  texto: string;
  color: 'morado' | 'azul' | 'gris' | 'verde' | 'naranja' | 'rojo';
}

export function Badge({ texto, color }: BadgeProps) {
  const colores = {
    morado: { bg: '#f3e8ff', text: '#7e22ce' },
    azul: { bg: '#e0f2fe', text: '#0369a1' },
    gris: { bg: '#f3f4f6', text: '#4b5563' },
    verde: { bg: '#dcfce7', text: '#15803d' },
    naranja: { bg: '#ffedd5', text: '#c2410c' },
    rojo: { bg: '#fee2e2', text: '#b91c1c' }
  };
  
  const theme = colores[color] || colores.gris; // Por si acaso llega un color raro

  return (
    <span style={{ 
      backgroundColor: theme.bg, color: theme.text, 
      padding: '4px 12px', borderRadius: '12px', 
      fontSize: '13px', fontWeight: 'bold', display: 'inline-block'
    }}>
      {texto}
    </span>
  );
}