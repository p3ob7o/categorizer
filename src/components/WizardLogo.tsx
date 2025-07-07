import React from 'react';

interface WizardLogoProps {
  className?: string;
}

export default function WizardLogo({ className = "h-6 w-6" }: WizardLogoProps) {
  return (
    <div className={className}>
      <svg 
        viewBox="0 0 100 100" 
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Wizard hat */}
        <path d="M50 5 L75 70 L25 70 Z" fill="currentColor"/>
        {/* Hat brim */}
        <ellipse cx="50" cy="70" rx="30" ry="8" fill="currentColor"/>
        
        {/* Eyes - white for light mode (black hat), black for dark mode (white hat) */}
        <ellipse cx="42" cy="45" rx="4" ry="6" fill="#ffffff" className="dark:fill-black"/>
        <ellipse cx="58" cy="45" rx="4" ry="6" fill="#ffffff" className="dark:fill-black"/>
        
        {/* Smile - white for light mode (black hat), black for dark mode (white hat) */}
        <path d="M40 55 Q50 65 60 55" stroke="#ffffff" strokeWidth="3" fill="none" strokeLinecap="round" className="dark:stroke-black"/>
        
        {/* Hat curve */}
        <path d="M50 5 Q60 15 55 25" stroke="currentColor" strokeWidth="2" fill="none"/>
      </svg>
    </div>
  );
} 