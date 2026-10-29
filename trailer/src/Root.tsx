import React from 'react';
import { Composition } from 'remotion';
import { Trailer } from './Trailer';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="NEORUSH-Trailer"
      component={Trailer}
      durationInFrames={600}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{
        title: 'NEORUSH',
        tagline: 'HYPER-VELOCITY 3D CYBER RACER',
        accentColor: '#00e5ff',
      }}
    />
  );
};
