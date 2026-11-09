import { ExternalLink, X } from 'lucide-react';
import { groupLabel } from './types';
import type { MapPoint, PointGroup } from './types';

interface Props {
  point: MapPoint;
  groups: PointGroup[];
  onClose: () => void;
  onSelectGroup: (id: string) => void;
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const linkLabel = (link: string) => {
  if (link.includes('ru.wikipedia.org')) return 'Статья в Википедии';
  if (link.includes('wikipedia.org')) return 'Статья в Википедии (англ.)';
  return 'Wikidata';
};

function PointCard({ point, groups, onClose, onSelectGroup }: Props) {
  const facts = [point.type && capitalize(point.type), point.year].filter(Boolean).join(', ');
  const location = [point.place, point.country].filter((part, index, parts) => part && parts.indexOf(part) === index).join(', ');
  const credit = [point.photo?.author, point.photo?.license].filter(Boolean).join(', ');

  return (
    <article className="absolute z-10 inset-x-2 bottom-2 max-h-[70%] md:inset-x-auto md:left-3 md:bottom-8 md:top-3 md:max-h-none md:w-80 flex flex-col rounded-xl bg-white shadow-lg overflow-hidden text-sm text-slate-700">
      <button
        onClick={onClose}
        aria-label="Закрыть"
        className="absolute top-2 right-2 z-10 p-1 rounded-full bg-white/90 shadow text-slate-500 hover:text-slate-800"
      >
        <X className="w-4 h-4" />
      </button>
      <div className="overflow-y-auto">
        {point.photo && (
          <figure className="m-0">
            {/* key сбрасывает старое фото, пока грузится новое */}
            <img
              key={point.photo.src}
              src={point.photo.src}
              alt={point.name}
              width={480}
              className="block w-full h-44 md:h-52 object-cover rounded-none max-w-none bg-slate-100"
            />
            <figcaption className="px-4 pt-1 text-[11px] leading-snug text-slate-400">
              <a href={point.photo.source} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-slate-600">
                {credit ? `Фото: ${credit}` : 'Фото: Wikimedia Commons'}
              </a>
            </figcaption>
          </figure>
        )}
        <div className="p-4 pt-3">
          <h2 className="m-0 pr-6 text-base leading-snug font-semibold text-slate-900">{point.name}</h2>
          {facts && <p className="mt-1 mb-0">{facts}</p>}
          {location && <p className="mt-1 mb-0 text-slate-500">{location}</p>}
          <ul className="mt-3 mb-0 p-0 list-none flex flex-wrap gap-1.5">
            {point.groups.map((id) => {
              const group = groups.find((candidate) => candidate.id === id);
              return group && (
                <li key={id}>
                  <button
                    onClick={() => onSelectGroup(id)}
                    title={`Оставить на карте только: ${groupLabel(group)}`}
                    className="px-2 py-1 rounded-md bg-pink-50 text-pink-700 hover:bg-pink-100 text-xs font-medium text-left"
                  >
                    {groupLabel(group)}
                  </button>
                </li>
              );
            })}
          </ul>
          {point.link && (
            <a
              href={point.link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium"
            >
              {linkLabel(point.link)}
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

export default PointCard;
