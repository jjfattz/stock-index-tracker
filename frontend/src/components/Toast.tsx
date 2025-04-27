"use client";

import React, { useState, useEffect } from "react";

interface ToastProps {
  message: string;
  type: "success" | "error" | "info";
  duration?: number;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({
  message,
  type,
  duration = 5000,
  onClose,
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const baseStyle =
    "fixed bottom-5 right-5 p-4 rounded shadow-lg text-white max-w-sm z-50 transition-opacity duration-300";
  const typeStyles = {
    success: "bg-green-500",
    error: "bg-red-500",
    info: "bg-blue-500",
  };

  const handleClose = () => {
    setIsVisible(false);
    onClose();
  };

  if (!isVisible) return null;

  return (
    <div
      className={`${baseStyle} ${typeStyles[type]} ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="flex justify-between items-center">
        <span>{message}</span>
        <button
          onClick={handleClose}
          className="ml-4 text-xl font-semibold leading-none"
        >
          &times;
        </button>
      </div>
    </div>
  );
};

export default Toast;
