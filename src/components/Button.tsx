import React from 'react';

type PrimaryTone = 'blue' | 'purple' | 'pink' | 'green';

type RoundedKind = 'lg' | 'full';

interface PrimaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    tone?: PrimaryTone;
    rounded?: RoundedKind;
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({ tone = 'blue', rounded = 'lg', className = '', ...props }) => {
    const toneClasses =
        tone === 'purple'
            ? 'bg-purple-600 hover:bg-purple-500 disabled:bg-purple-900'
            : tone === 'pink'
            ? 'bg-pink-600 hover:bg-pink-500 disabled:bg-pink-900'
            : tone === 'green'
            ? 'bg-green-600 hover:bg-green-500 disabled:bg-green-900'
            : 'bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900';

    const roundedClass = rounded === 'full' ? 'rounded-full' : 'rounded-lg';

    return (
        <button
            {...props}
            className={`inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white ${roundedClass} ${toneClasses} disabled:text-gray-400 disabled:cursor-not-allowed transition-colors ${className}`}
        />
    );
};

interface SecondaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    rounded?: RoundedKind;
}

export const SecondaryButton: React.FC<SecondaryButtonProps> = ({ rounded = 'lg', className = '', ...props }) => {
    const roundedClass = rounded === 'full' ? 'rounded-full' : 'rounded-lg';

    return (
        <button
            {...props}
            className={`inline-flex items-center justify-center px-3 py-1.5 text-sm border border-gray-600 bg-gray-900 text-gray-100 hover:bg-gray-700/60 disabled:bg-gray-900 disabled:text-gray-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors ${roundedClass} ${className}`}
        />
    );
};
