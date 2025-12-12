import React, { useEffect, useState } from 'react';
import { loadPetsByZone } from '../utils/petCardUtils';
import type { PetCard } from '../components/pets/types';
import PetCapabilitiesEditor from '../components/pets/PetCapabilitiesEditor';

const CampRefactor: React.FC = () => {
    const [pets, setPets] = useState<PetCard[]>([]);
    const [selectedPet, setSelectedPet] = useState<PetCard | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchPets = async () => {
            try {
                const sanctuaryPets = await loadPetsByZone('sanctuary');
                setPets(sanctuaryPets);
            } catch (e) {
                console.error('Failed to load pets:', e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchPets();
    }, []);

    const handleSavePet = async (updatedPet: PetCard) => {
        console.log('Saving updated pet:', updatedPet);
        
        // Persist to Hypercore via p2pAppend
        if (window.electronAPI?.p2pAppend && updatedPet.coreName) {
            try {
                await window.electronAPI.p2pAppend({
                    name: updatedPet.coreName,
                    data: JSON.stringify(updatedPet),
                });
                
                // Update local list
                setPets(prev => prev.map(p => p.id === updatedPet.id ? updatedPet : p));
                setSelectedPet(null); // Close editor
            } catch (err) {
                console.error('Failed to save pet:', err);
            }
        }
    };

    return (
        <div className="h-full bg-gray-900 flex flex-col p-6">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <span className="text-4xl">⛺</span>
                    Camp Refactor
                </h1>
                <p className="text-gray-400 mt-2">
                    Train your Phamiliars. Assign capabilities, refine behavior, and configure agentic states.
                </p>
            </header>

            {isLoading ? (
                <div className="flex-1 flex items-center justify-center text-gray-500">
                    Loading Sanctuary...
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                        {pets.map(pet => (
                            <div 
                                key={pet.id}
                                onClick={() => setSelectedPet(pet)}
                                className="bg-gray-800 border border-gray-700 rounded-xl p-4 cursor-pointer hover:border-purple-500 hover:bg-gray-800/80 transition-all group relative overflow-hidden"
                            >
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                
                                <div className="flex justify-center mb-4 relative">
                                    <div className="w-24 h-24 bg-gray-900 rounded-full flex items-center justify-center overflow-hidden border-2 border-gray-700 group-hover:border-purple-500/50 transition-colors">
                                        {pet.thumbnail ? (
                                            <img src={pet.thumbnail} alt={pet.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="text-4xl">🐾</div>
                                        )}
                                    </div>
                                    {pet.capabilities && pet.capabilities.length > 0 && (
                                        <div className="absolute -bottom-2 bg-purple-900 text-purple-200 text-[10px] font-bold px-2 py-0.5 rounded-full border border-purple-500/50">
                                            {pet.capabilities.length} Skills
                                        </div>
                                    )}
                                </div>
                                
                                <div className="text-center">
                                    <h3 className="font-bold text-white text-lg">{pet.name}</h3>
                                    <p className="text-xs text-gray-500 uppercase tracking-wider mt-1">{pet.species}</p>
                                </div>

                                <div className="mt-4 pt-4 border-t border-gray-700 flex justify-center">
                                    <span className="text-xs text-cyan-400 group-hover:underline">Enter Training</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {selectedPet && (
                <PetCapabilitiesEditor 
                    pet={selectedPet}
                    onSave={handleSavePet}
                    onClose={() => setSelectedPet(null)}
                />
            )}
        </div>
    );
};

export default CampRefactor;
