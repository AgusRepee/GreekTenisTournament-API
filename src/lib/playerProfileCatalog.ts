export type PlayerProfileCatalogRow = {
  tournamentKey: string;
  firstName: string;
  lastName: string;
  nationality: string;
  playingHand: 'Derecha' | 'Zurdo';
  birthDate: string;
  profileImage?: string;
};

/** Sincronizado con Frontend `src/data/playerProfileCatalog.ts` y tools/player-profile-import/jugadores.txt */
export const PLAYER_PROFILE_CATALOG: readonly PlayerProfileCatalogRow[] = [
  { tournamentKey: 'Urbini A.', firstName: 'Augusto', lastName: 'Urbini', nationality: 'Argentina', playingHand: 'Derecha', birthDate: '1980-10-03', profileImage: 'players/augusto.webp' },
  { tournamentKey: 'Cellilli F.', firstName: 'Facundo', lastName: 'Cellilli', nationality: 'Argentina', playingHand: 'Derecha', birthDate: '1994-10-13', profileImage: 'players/facundo.webp' },
  { tournamentKey: 'Oswald J.', firstName: 'Juan Pablo', lastName: 'Oswald', nationality: 'Argentina', playingHand: 'Derecha', birthDate: '1997-11-16', profileImage: 'players/juan-pablo.webp' },
  { tournamentKey: 'Repecka J.', firstName: 'Javier', lastName: 'Repecka', nationality: 'Argentina', playingHand: 'Derecha', birthDate: '1967-02-04', profileImage: 'players/javier.webp' },
  { tournamentKey: 'Oviedo Mammola M.', firstName: 'Maximo', lastName: 'Oviedo Mammola', nationality: 'Argentina', playingHand: 'Derecha', birthDate: '2005-05-16', profileImage: 'players/maximo.webp' },
  { tournamentKey: 'Fernández B.', firstName: 'Brian', lastName: 'Fernández', nationality: 'Argentina', playingHand: 'Derecha', birthDate: '1990-12-10', profileImage: 'players/brian.webp' },
  { tournamentKey: 'Fernandez B.', firstName: 'Brian', lastName: 'Fernández', nationality: 'Argentina', playingHand: 'Derecha', birthDate: '1990-12-10', profileImage: 'players/brian.webp' },
  { tournamentKey: 'Jaureguiberry C.', firstName: 'Camilo', lastName: 'Jaureguiberry', nationality: 'Argentina', playingHand: 'Derecha', birthDate: '1986-11-14', profileImage: 'players/camilo.webp' },
  { tournamentKey: 'Gimenez F.', firstName: 'Federico', lastName: 'Gimenez', nationality: 'Argentina', playingHand: 'Derecha', birthDate: '1998-01-15', profileImage: 'players/federico-gimenez.webp' },
  { tournamentKey: 'Cordoba G.', firstName: 'Gonzalo', lastName: 'Cordoba', nationality: 'Argentina', playingHand: 'Derecha', birthDate: '1975-11-26' },
  { tournamentKey: 'Peralta G.', firstName: 'German', lastName: 'Peralta', nationality: 'Uruguay', playingHand: 'Derecha', birthDate: '1982-01-31' },
  { tournamentKey: 'Cardozo M.', firstName: 'Matías', lastName: 'Cardozo', nationality: 'Uruguay', playingHand: 'Derecha', birthDate: '1980-10-07', profileImage: 'players/matias-cardozo.webp' },
  { tournamentKey: 'Aguorre W.', firstName: 'Walter', lastName: 'Aguorre', nationality: 'Argentina', playingHand: 'Zurdo', birthDate: '1971-12-14' },
  { tournamentKey: 'Aguirre W.', firstName: 'Walter', lastName: 'Aguorre', nationality: 'Argentina', playingHand: 'Zurdo', birthDate: '1971-12-14' },
  { tournamentKey: 'Casadio M.', firstName: 'Marco', lastName: 'Casadio', nationality: 'Argentina', playingHand: 'Derecha', birthDate: '1982-08-03', profileImage: 'players/marco.webp' },
  { tournamentKey: 'Duarte D.', firstName: 'Diego', lastName: 'Duarte', nationality: 'Argentina', playingHand: 'Derecha', birthDate: '1981-04-04', profileImage: 'players/diego.webp' },
  { tournamentKey: 'Naddeo M.', firstName: 'Martin', lastName: 'Naddeo', nationality: 'Argentina', playingHand: 'Derecha', birthDate: '1971-10-08', profileImage: 'players/martin.webp' },
  { tournamentKey: 'Fratini M.', firstName: 'Matías', lastName: 'Fratini', nationality: 'Argentina', playingHand: 'Derecha', birthDate: '2004-12-15', profileImage: 'players/matias-fratini.webp' },
  { tournamentKey: 'Komesu F.', firstName: 'Franco', lastName: 'Komesu', nationality: 'Argentina', playingHand: 'Derecha', birthDate: '2008-03-04', profileImage: 'players/franco.webp' },
  { tournamentKey: 'Vidigt F.', firstName: 'Franco', lastName: 'Vidigt', nationality: 'Argentina', playingHand: 'Derecha', birthDate: '1994-01-19', profileImage: 'players/franco-vidigt.webp' },
  { tournamentKey: 'Mayer D.', firstName: 'Daniel', lastName: 'Mayer', nationality: 'Argentina', playingHand: 'Derecha', birthDate: '1980-02-16' },
  { tournamentKey: 'Gonzalez Dias J.', firstName: 'Jorge Fernando', lastName: 'Gonzalez Dias', nationality: 'Argentina', playingHand: 'Derecha', birthDate: '1974-09-18', profileImage: 'players/jorge.webp' },
  { tournamentKey: 'Lacave L.', firstName: 'Leandro', lastName: 'Lacave', nationality: 'Argentina', playingHand: 'Derecha', birthDate: '1990-11-30', profileImage: 'players/leandro.webp' },
  { tournamentKey: 'Chantada M.', firstName: 'Marcelo', lastName: 'Chantada', nationality: 'Argentina', playingHand: 'Derecha', birthDate: '1964-08-22', profileImage: 'players/marcelo.webp' },
  { tournamentKey: 'Santi G.', firstName: 'Guillermo', lastName: 'Santi', nationality: 'Argentina', playingHand: 'Zurdo', birthDate: '1962-04-27', profileImage: 'players/guillermo.webp' },
  { tournamentKey: 'Blanco J.', firstName: 'Jose', lastName: 'Blanco', nationality: 'Argentina', playingHand: 'Derecha', birthDate: '1962-11-10', profileImage: 'players/jose.webp' },
  { tournamentKey: 'Santi Mar.', firstName: 'Marcelo', lastName: 'Santi', nationality: 'Argentina', playingHand: 'Derecha', birthDate: '1965-02-19' },
  { tournamentKey: 'Bobbio M.', firstName: 'Marcelo Fabian', lastName: 'Bobbio', nationality: 'Argentina', playingHand: 'Derecha', birthDate: '1969-01-27', profileImage: 'players/marcelo-bobbio.webp' },
  { tournamentKey: 'Bocchicchio F.', firstName: 'Fernando', lastName: 'Bocchicchio', nationality: 'Argentina', playingHand: 'Derecha', birthDate: '1975-11-20' },
  { tournamentKey: 'Garassi A.', firstName: 'Alejandro Nicolas', lastName: 'Garassi', nationality: 'Argentina', playingHand: 'Derecha', birthDate: '1990-06-08', profileImage: 'players/alejandro.webp' },
  { tournamentKey: 'Barrios D.', firstName: 'Diego', lastName: 'Barrios', nationality: 'Argentina', playingHand: 'Derecha', birthDate: '1967-09-20', profileImage: 'players/diego-barrios.webp' },
  { tournamentKey: 'Filosa M.', firstName: 'Matias', lastName: 'Filosa', nationality: 'Argentina', playingHand: 'Derecha', birthDate: '1984-11-14', profileImage: 'players/matias.webp' },
  { tournamentKey: 'Ballesta F.', firstName: 'Flavio', lastName: 'Ballesta', nationality: 'Argentina', playingHand: 'Derecha', birthDate: '1982-04-19' },
  { tournamentKey: 'Colomer S.', firstName: 'Santiago', lastName: 'Colomer', nationality: 'Argentina', playingHand: 'Derecha', birthDate: '1974-02-03', profileImage: 'players/santiago.webp' },
  { tournamentKey: 'Cellilli M.', firstName: 'Marcelo', lastName: 'Cellilli', nationality: 'Argentina', playingHand: 'Derecha', birthDate: '1965-06-26', profileImage: 'players/marcelo-cellilli.webp' },
  { tournamentKey: 'Marin G.', firstName: 'Gustavo', lastName: 'Marin', nationality: 'Argentina', playingHand: 'Derecha', birthDate: '1981-06-05', profileImage: 'players/gustavo.webp' },
  { tournamentKey: 'Avalos G.', firstName: 'Gonzalo Fernando', lastName: 'Avalos', nationality: 'Argentina', playingHand: 'Derecha', birthDate: '1976-05-19', profileImage: 'players/gonzalo-fernando.webp' },
  { tournamentKey: 'Annetta D.', firstName: 'Dario', lastName: 'Annetta', nationality: 'Argentina', playingHand: 'Derecha', birthDate: '1971-05-29', profileImage: 'players/dario.webp' },
  { tournamentKey: 'Vera F.', firstName: 'Fernando', lastName: 'Vera', nationality: 'Argentina', playingHand: 'Derecha', birthDate: '1970-04-04', profileImage: 'players/fernando.webp' },
  { tournamentKey: 'Gadea M.', firstName: 'Marcelo', lastName: 'Gadea', nationality: 'Argentina', playingHand: 'Derecha', birthDate: '1968-05-20' },
  { tournamentKey: 'Rossi F.', firstName: 'Franco', lastName: 'Rossi', nationality: 'Argentina', playingHand: 'Derecha', birthDate: '1970-12-06', profileImage: 'players/franco-rossi.webp' },
  { tournamentKey: 'Bernardini G.', firstName: 'Guido', lastName: 'Bernardini', nationality: 'Argentina', playingHand: 'Derecha', birthDate: '1998-01-04', profileImage: 'players/guido.webp' },
  { tournamentKey: 'Rusel S.', firstName: 'Silvio', lastName: 'Rusel', nationality: 'Argentina', playingHand: 'Derecha', birthDate: '1977-10-04', profileImage: 'players/silvio.webp' },
  { tournamentKey: 'Fusto B.', firstName: 'Bautista', lastName: 'Fusto', nationality: 'Argentina', playingHand: 'Derecha', birthDate: '1999-02-11' },
  { tournamentKey: 'Fedrjanic N.', firstName: 'Nicolas', lastName: 'Fedrjanic', nationality: 'Argentina', playingHand: 'Zurdo', birthDate: '1994-11-08', profileImage: 'players/nicolas-fedrjanic.webp' },
  { tournamentKey: 'Garcia J.', firstName: 'Juan', lastName: 'Garcia', nationality: 'Argentina', playingHand: 'Derecha', birthDate: '2004-10-25' },
  { tournamentKey: 'Bianco D.', firstName: 'Diego', lastName: 'Bianco', nationality: 'Argentina', playingHand: 'Derecha', birthDate: '1977-08-18', profileImage: 'players/diego-bianco.webp' },
  { tournamentKey: 'González Días C.', firstName: 'Christian', lastName: 'Gonzalez Dias', nationality: 'Argentina', playingHand: 'Derecha', birthDate: '1976-05-19', profileImage: 'players/christian-gonzalez-dias.webp' },
  { tournamentKey: 'Gonzalez Dias C.', firstName: 'Christian', lastName: 'Gonzalez Dias', nationality: 'Argentina', playingHand: 'Derecha', birthDate: '1976-05-19', profileImage: 'players/christian-gonzalez-dias.webp' },
  { tournamentKey: 'Araujo J.', firstName: 'Juan Manuel', lastName: 'Araujo', nationality: 'Argentina', playingHand: 'Derecha', birthDate: '1980-02-14', profileImage: 'players/juan-manuel-araujo.webp' },
  { tournamentKey: 'Alvarez I.', firstName: 'Ivan', lastName: 'Alvarez', nationality: 'Argentina', playingHand: 'Derecha', birthDate: '1971-08-10', profileImage: 'players/ivan-alvarez.webp' },
  { tournamentKey: 'Tacain R.', firstName: 'Roman', lastName: 'Tacain', nationality: 'Argentina', playingHand: 'Derecha', birthDate: '2002-06-11' },
  { tournamentKey: 'Antuña A.', firstName: 'Alberto', lastName: 'Antuña', nationality: 'Argentina', playingHand: 'Derecha', birthDate: '1987-10-25', profileImage: 'players/alberto-antuna.webp' },
  { tournamentKey: 'Molina L.', firstName: 'Leonardo', lastName: 'Molina', nationality: 'Argentina', playingHand: 'Derecha', birthDate: '1982-05-17' },
  { tournamentKey: 'Miletta J.', firstName: 'Juan Jose', lastName: 'Miletta', nationality: 'Argentina', playingHand: 'Derecha', birthDate: '1972-08-08', profileImage: 'players/juan-jose-miletta.webp' },
];

export function normPlayerCatalogKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
