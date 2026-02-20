import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './Tooltip.scss';

/**
 * Tooltip Component
 * Uses React Portal to render tooltip at document body level to avoid clipping (overflow: hidden).
 */
const Tooltip = ({ text, position = 'top', children, className = '' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const containerRef = useRef(null);

  const calculatePosition = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const gap = 10; // Space between element and tooltip
    
    // We need approximate size of tooltip to center it. 
    // Since we can't measure it before rendering easily without double render,
    // we'll approximate centering or rely on CSS transform for centering relative to the calculated point.
    // However, transform: translate(-50%) works well with fixed positioning too.

    let top = 0;
    let left = 0;
    
    // Base coords
    switch (position) {
      case 'top':
        top = rect.top - gap;
        left = rect.left + rect.width / 2;
        break;
      case 'bottom':
        top = rect.bottom + gap;
        left = rect.left + rect.width / 2;
        break;
      case 'left':
        top = rect.top + rect.height / 2;
        left = rect.left - gap;
        break;
      case 'right':
        top = rect.top + rect.height / 2;
        left = rect.right + gap;
        break;
      default:
        top = rect.top - gap;
        left = rect.left + rect.width / 2;
    }

    setCoords({ top, left });
  };

  const handleMouseEnter = () => {
    calculatePosition();
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  // Recalculate on scroll (optional, but good for fixed elements)
  useEffect(() => {
    if (isVisible) {
      const handleScroll = () => calculatePosition();
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleScroll);
      return () => {
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleScroll);
      };
    }
  }, [isVisible]);

  const tooltipStyle = {
    position: 'fixed',
    top: `${coords.top}px`,
    left: `${coords.left}px`,
    zIndex: 9999, // Very high z-index
    // Use transform to center based on the anchor point
    transform: 
      position === 'top' ? 'translate(-50%, -100%)' :
      position === 'bottom' ? 'translate(-50%, 0)' :
      position === 'left' ? 'translate(-100%, -50%)' :
      /* right */           'translate(0, -50%)'
  };

  if (!text) return children;

  return (
    <div 
      className={`tooltip-container ${className}`} 
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {isVisible && createPortal(
        <div 
          className="tooltip-text visible"
          style={tooltipStyle}
        >
          {text}
        </div>,
        document.body
      )}
    </div>
  );
};

export default Tooltip;
