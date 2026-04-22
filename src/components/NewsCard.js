import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

export default function NewsCard({ title, image, description, date, author, href }) {
  return (
    <article className="glass-card overflow-hidden rounded-[2rem] transition-transform duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_36px_rgba(148,163,184,0.15)]">
      {image && (
        <div className="relative h-48">
          <Image
            src={image}
            alt={title}
            fill
            className="object-cover"
          />
        </div>
      )}
      <div className="p-5">
        <h2 className="mb-2 text-[1.15rem] font-semibold text-slate-700">
          {href ? (
            <Link href={href} className="hover:text-slate-950">
              {title}
            </Link>
          ) : (
            title
          )}
        </h2>
        <p className="mb-3 text-[0.95rem] leading-6 text-slate-400">{description}</p>
        <div className="flex justify-between text-sm text-slate-400/90">
          <span>{author}</span>
          <span>{date}</span>
        </div>
      </div>
    </article>
  );
}
