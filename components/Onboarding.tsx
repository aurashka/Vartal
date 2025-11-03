import React, { useState } from 'react';
import { ChevronLeftIcon, LoopsIcon } from './common/Icons';

// Mock data for inspired people collage
const inspiredPeople = [
    'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=100&fit=crop&q=80',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&fit=crop&q=80',
    'https://images.unsplash.com/photo-1552058544-f2b08422138a?w=100&fit=crop&q=80',
    'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&fit=crop&q=80',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&fit=crop&q=80',
    'https://images.unsplash.com/photo-1499952127939-9bbf5af6c51c?w=100&fit=crop&q=80',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&fit=crop&q=80',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&fit=crop&q=80',
    'https://images.unsplash.com/photo-1521119989659-a83eee488004?w=100&fit=crop&q=80',
    'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=100&fit=crop&q=80'
];

interface OnboardingProps {
  onFinish: () => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ onFinish }) => {
    const [step, setStep] = useState(0); // 0: Inspired, 1: Carousel, 2: Notifications
    const [carouselStep, setCarouselStep] = useState(0);

    const handleFinish = async () => {
        onFinish();
    };

    const carouselPages = [
        {
            image: 'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?q=80&w=870&auto=format&fit=crop',
            title: 'Find Events That Excite You',
            description: 'Concerts, parties, and cool spots all happening around you.'
        },
        {
            image: 'https://images.unsplash.com/photo-1519638831568-d9897f54ed69?q=80&w=870&auto=format&fit=crop',
            title: 'Vendors That Bring The Vibe',
            description: 'Find top photographers and booths near you. Book fast and stress-free.'
        }
    ];

    const nextCarouselStep = () => {
        if (carouselStep < carouselPages.length - 1) {
            setCarouselStep(carouselStep + 1);
        } else {
            setStep(2); // Move to notification screen
        }
    };
    
    const renderDots = () => (
        <div className="flex justify-center items-center gap-2">
            {carouselPages.map((_, index) => (
                <div key={index} className={`h-2 rounded-full transition-all duration-300 ${carouselStep === index ? 'w-4 bg-primary' : 'w-2 bg-gray-300 dark:bg-gray-600'}`}></div>
            ))}
        </div>
    );
    
    const renderInspiredScreen = () => (
        <div className="flex flex-col items-center justify-between h-full w-full max-w-sm mx-auto text-center p-8">
            <div className="flex-grow flex items-center justify-center">
                 <div className="relative w-64 h-64">
                    <div className="w-24 h-24 rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 shadow-lg bg-primary flex items-center justify-center">
                        <LoopsIcon className="w-16 h-16 text-white" />
                    </div>
                    {inspiredPeople.map((src, index) => {
                        const angle = (index / inspiredPeople.length) * 2 * Math.PI;
                        const radius = 110;
                        const x = Math.cos(angle) * radius + 128 - 24;
                        const y = Math.sin(angle) * radius + 128 - 24;
                        const rotation = Math.random() * 20 - 10;
                        return (
                             <img 
                                key={index} 
                                src={`${src}&u=${index}`} 
                                alt={`inspired person ${index}`} 
                                className="w-12 h-12 rounded-full object-cover absolute shadow-md border-2 border-white dark:border-gray-800"
                                style={{ top: y, left: x, transform: `rotate(${rotation}deg)` }}
                            />
                        )
                    })}
                </div>
            </div>
            <div>
                <h1 className="text-4xl font-bold tracking-tight">Inspired people</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-4">Number of people inspired by your game or completion.</p>
                <button 
                    onClick={() => setStep(1)}
                    className="w-full mt-8 px-6 py-4 text-lg font-semibold text-white bg-gray-900 dark:bg-gray-200 dark:text-gray-900 rounded-full hover:opacity-90 transition-opacity"
                >
                    Cool!
                </button>
            </div>
        </div>
    );
    
    const renderCarouselScreen = () => {
        const page = carouselPages[carouselStep];
        return (
            <div className="flex flex-col h-full w-full max-w-sm mx-auto p-6">
                <div className="flex justify-between items-center mb-8">
                     <button onClick={() => setStep(0)} className={`p-2 -ml-2 text-gray-500 hover:text-gray-800 ${carouselStep > 0 ? 'invisible' : ''}`}><ChevronLeftIcon className="w-6 h-6"/></button>
                     <button onClick={handleFinish} className="font-semibold text-gray-600 dark:text-gray-400">Skip</button>
                </div>
                <div className="flex-grow flex flex-col justify-center items-center text-center">
                    <div className="w-full aspect-square mb-8 p-4">
                        <div className="w-full h-full bg-gray-200 dark:bg-gray-800 rounded-3xl rotate-[-6deg] relative shadow-lg">
                           <img src={page.image} alt={page.title} className="w-full h-full object-cover rounded-3xl rotate-[3deg]"/>
                        </div>
                    </div>
                    {renderDots()}
                    <h1 className="text-3xl font-bold mt-8">{page.title}</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-2 mx-4">{page.description}</p>
                </div>
                <button 
                    onClick={nextCarouselStep}
                    className="w-full mt-8 px-6 py-4 text-lg font-semibold text-white bg-primary rounded-xl hover:bg-primary-hover transition-colors"
                >
                    Continue ›
                </button>
            </div>
        );
    };

    const renderNotificationScreen = () => (
        <div className="flex flex-col items-center justify-between h-full w-full max-w-sm mx-auto text-center p-8">
            <div className="flex-grow flex items-center justify-center w-full">
                <div className="relative w-full max-w-xs">
                    <div className="absolute -top-8 -left-8 -right-8 -bottom-8 bg-gradient-to-br from-purple-300 via-pink-300 to-red-300 dark:from-purple-800 dark:via-pink-800 dark:to-red-800 rounded-full opacity-40 blur-2xl"></div>
                    <div className="relative w-full h-auto p-4 bg-white/30 dark:bg-gray-800/30 backdrop-blur-lg rounded-[40px]">
                        <div className="bg-black/10 dark:bg-white/10 w-24 h-6 mx-auto rounded-b-xl mb-4"></div>
                        <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-lg p-4">
                            <div className="flex items-center gap-3 mb-4">
                                <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&fit=crop&q=80" className="w-10 h-10 rounded-lg object-cover"/>
                                <div className="flex-1">
                                    <p className="font-semibold text-left text-sm">Lia Maria</p>
                                    <p className="text-xs text-gray-500 text-left">Added 23 photos to Outings.</p>
                                </div>
                                <span className="text-xs text-gray-400 self-start">now</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <img src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&fit=crop&q=80" className="w-10 h-10 rounded-lg object-cover"/>
                                <div className="flex-1">
                                    <p className="font-semibold text-left text-sm">Tom Avril</p>
                                    <p className="text-xs text-gray-500 text-left">Is eating at Done, Joondalup.</p>
                                </div>
                                <span className="text-xs text-gray-400 self-start">2m</span>
                            </div>

                             <div className="relative mt-8 flex justify-center items-center">
                                <div className="flex items-center">
                                   <img src={inspiredPeople[0]} className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-900 object-cover"/>
                                   <img src={inspiredPeople[1]} className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-900 -ml-3 object-cover"/>
                                   <img src={inspiredPeople[2]} className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-900 -ml-3 object-cover"/>
                                   <img src={inspiredPeople[3]} className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-900 -ml-3 object-cover"/>
                                </div>
                                <img src={inspiredPeople[4]} className="w-14 h-14 rounded-full ring-4 ring-pink-400 p-0.5 absolute -right-2 -bottom-2 object-cover"/>
                             </div>

                        </div>
                    </div>
                </div>
            </div>
            <div className="w-full">
                <h1 className="text-3xl font-bold tracking-tight">Don't miss out on what your friend's are up to.</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-4">Never miss those precious moments.</p>
                <button 
                    onClick={handleFinish}
                    className="w-full mt-8 px-6 py-4 text-lg font-semibold text-white bg-gray-900 dark:bg-gray-200 dark:text-gray-900 rounded-full hover:opacity-90 transition-opacity"
                >
                    Turn on notifications
                </button>
                 <button 
                    onClick={handleFinish}
                    className="w-full mt-4 text-md font-semibold text-gray-600 dark:text-gray-400"
                >
                    Another time
                </button>
            </div>
        </div>
    );
    

    const renderStep = () => {
        switch (step) {
            case 0: return renderInspiredScreen();
            case 1: return renderCarouselScreen();
            case 2: return renderNotificationScreen();
            default: return renderInspiredScreen();
        }
    };
    
    return (
        <div className="h-screen w-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300 font-sans overflow-hidden">
            {renderStep()}
        </div>
    );
};

export default Onboarding;
