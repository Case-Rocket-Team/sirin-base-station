import React from "react";

type Props = {
  children: React.ReactNode;
  width?: number;   // % of viewport width
  height?: number;  // % of viewport height
  x?: number;       // % from left
  y?: number;       // % from top
};

export default function Window({
  children,
  width = 20,
  height = 30,
  x = 5,
  y = 10,
}: Props) {
  return (
    <div
      style={{
        position: "absolute",
        left: `${x}vw`,
        top: `${y}vh`,
        width: `${width}vw`,
        height: `${height}vh`,
      }}
    >
      {children}
    </div>
  );
}