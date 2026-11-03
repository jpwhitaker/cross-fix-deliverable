'use client';
import { IoBrushOutline } from 'react-icons/io5';
import type { SurfFixRideOption } from '@/lib/surf-fix-rules/game/transient-projection';
export type RidePickerProps = {
    text: string;
    pathKey: string;
    options: readonly SurfFixRideOption[];
    applied: boolean;
    disabled: boolean;
    onChoose: (tileIds: readonly string[], boardKey: string) => void;
};
export function RidePicker({ text, pathKey, options, applied, disabled, onChoose }: RidePickerProps) {
    const hasAlternative = options.some(option => option.key !== pathKey);
    const canChange = !disabled && hasAlternative;
    const hasCurrent = options.some(option => option.key === pathKey);
    return <label className="pointer-events-auto flex min-h-8 max-w-[min(62vw,360px)] items-center gap-1.5 rounded-lg border-2 border-[#111] bg-white px-2.5 text-xs font-semibold text-[#111] shadow-[2px_2px_0_#111]">
    {applied && <IoBrushOutline size={14} className="shrink-0" aria-hidden="true"/>}
    <span className="shrink-0">Ride:</span>
    <select aria-label="Choose Ride" value={pathKey} disabled={!canChange} title={disabled ? 'Apply or cancel your brush selection first.' : 'Choose the word to feature as your Ride'} className={`min-w-0 truncate bg-transparent py-1 font-headline font-semibold text-[#111] disabled:opacity-100 enabled:cursor-pointer${hasAlternative ? '' : ' appearance-none'}`} onChange={event => {
            const option = options.find(candidate => candidate.key === event.target.value);
            if (option && canChange)
                onChoose(option.tileIds, option.boardKey);
        }}>
      {!hasCurrent && <option value={pathKey} disabled>{text}</option>}
      {options.map(option => <option key={option.key} value={option.key}>
        {option.text}{options.some(other => other.key !== option.key && other.text === option.text)
                ? ` · row ${option.cells[0].row}, col ${option.cells[0].col}` : ''}
      </option>)}
    </select>
  </label>;
}
