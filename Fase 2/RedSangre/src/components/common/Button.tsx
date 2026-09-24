interface ButtonProps {
  texto: string;
  onClick?: () => void;
  disabled?: boolean;
}

export function Button({ texto, onClick, disabled }: ButtonProps) {
  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      style={{
        backgroundColor: disabled ? '#ccc' : '#bb4442', /* El rojo hermoso de tu mockup */
        color: 'white', 
        padding: '12px 24px', 
        border: 'none', 
        borderRadius: '8px', 
        fontWeight: 'bold', 
        fontSize: '15px', 
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background-color 0.2s',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)' /* Una sombrita para que resalte más */
      }}
    >
      {texto}
    </button>
  );
}