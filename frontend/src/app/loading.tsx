"use client";
import React from 'react';

const LoadingSpinner: React.FC<{ loadingText?: string }> = ({ loadingText }) => {
    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <div className="text-center">
                <div className="spinner-border animate-spin inline-block w-8 h-8 border-4 border-t-transparent border-blue-500 rounded-full" role="status">
                    <span className="visually-hidden"></span>
                </div>
                {loadingText && <p>{loadingText}</p>}
            </div>
        </div>
    );
}

export default LoadingSpinner;
